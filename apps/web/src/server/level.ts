import { defaultVerdict, sameVerdictScale, verdictScaleSchema } from "@repo/shared";
import type { Prisma } from "@/generated/prisma/client";
import { memberOf, toLevel } from "./collection";
import { prisma } from "./db";
import { authed } from "./orpc";

// Locks the Collection's row for the rest of the transaction, so two changes
// to its Levels can't both read the same deepest Level. Returns false when
// the Collection is missing or the User isn't a member.
export async function lockCollection(tx: Prisma.TransactionClient, collectionId: string, userId: string) {
  const collection = await tx.collection.findFirst({
    where: { id: collectionId, ...memberOf(userId) },
    select: { id: true },
  });
  if (!collection) return false;
  await tx.$queryRaw`select id from collection where id = ${collection.id} for update`;
  return true;
}

// Locks a Level's row so its Overall Verdict scale can't change underneath a
// rating, nor a rating appear while the scale is being changed. "share" is
// for writers of ratings (many may hold it at once); "update" is for scale
// changes. Callers must have checked membership already.
export async function lockLevelVerdict(tx: Prisma.TransactionClient, levelId: string, mode: "share" | "update") {
  if (mode === "share") {
    await tx.$queryRaw`select id from level where id = ${levelId} for share`;
  } else {
    await tx.$queryRaw`select id from level where id = ${levelId} for update`;
  }
}

export const level = {
  rename: authed.level.rename.handler(async ({ input, context, errors }) => {
    const found = await prisma.level.findFirst({
      where: { id: input.id, collection: memberOf(context.user.id) },
      select: { id: true },
    });
    if (!found) throw errors.NOT_FOUND();
    return toLevel(await prisma.level.update({ where: { id: found.id }, data: { name: input.name } }));
  }),

  updateVerdict: authed.level.updateVerdict.handler(async ({ input, context, errors }) => {
    return prisma.$transaction(async (tx) => {
      const found = await tx.level.findFirst({
        where: { id: input.id, collection: memberOf(context.user.id) },
        select: { id: true },
      });
      if (!found) throw errors.NOT_FOUND();
      // rating.setOverall takes a share lock on the same row before reading
      // the scale, so no rating can land between this count and the update.
      await lockLevelVerdict(tx, found.id, "update");
      const current = await tx.level.findUniqueOrThrow({
        where: { id: found.id },
        select: { overallVerdictScale: true },
      });
      // Resending the current scale (say, alongside a rename) isn't a change.
      const currentScale = verdictScaleSchema.parse(current.overallVerdictScale);
      const scaleChanges = input.scale !== undefined && !sameVerdictScale(currentScale, input.scale);
      if (scaleChanges) {
        const ratingCount = await tx.overallRating.count({ where: { item: { levelId: found.id } } });
        if (ratingCount > 0) throw errors.SCALE_LOCKED({ data: { ratingCount } });
      }
      const row = await tx.level.update({
        where: { id: found.id },
        data: { overallVerdictName: input.name, overallVerdictScale: scaleChanges ? input.scale : undefined },
      });
      return toLevel(row);
    });
  }),

  appendDeepest: authed.level.appendDeepest.handler(async ({ input, context, errors }) => {
    return prisma.$transaction(async (tx) => {
      if (!(await lockCollection(tx, input.collectionId, context.user.id))) throw errors.NOT_FOUND();
      const deepest = await tx.level.findFirst({
        where: { collectionId: input.collectionId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const row = await tx.level.create({
        data: {
          collectionId: input.collectionId,
          name: input.name,
          position: (deepest?.position ?? -1) + 1,
          overallVerdictName: defaultVerdict.name,
          overallVerdictScale: defaultVerdict.scale,
        },
      });
      return toLevel(row);
    });
  }),

  removeDeepest: authed.level.removeDeepest.handler(async ({ input, context, errors }) => {
    await prisma.$transaction(async (tx) => {
      if (!(await lockCollection(tx, input.collectionId, context.user.id))) throw errors.NOT_FOUND();
      const deepest = await tx.level.findFirstOrThrow({
        where: { collectionId: input.collectionId },
        orderBy: { position: "desc" },
        select: { id: true, position: true, _count: { select: { items: true } } },
      });
      if (deepest.position === 0) throw errors.ONLY_LEVEL();
      // The Item foreign key also refuses this delete; checking first gives
      // the caller a typed error with the count. item.create takes the same
      // Collection lock, so no Item can land between this count and the delete.
      if (deepest._count.items > 0) throw errors.LEVEL_HAS_ITEMS({ data: { itemCount: deepest._count.items } });
      await tx.level.delete({ where: { id: deepest.id } });
    });
  }),
};
