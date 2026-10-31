import { defaultVerdict, type Level, sameRatingScale, type RatingScale, ratingScaleSchema } from "@repo/shared";
import type { Prisma } from "@/generated/prisma/client";
import { findMemberCollection, findMemberLevel } from "./access";
import { prisma } from "./db";
import { authed } from "./orpc";

type LevelRow = Pick<
  Prisma.LevelGetPayload<object>,
  "id" | "name" | "position" | "overallVerdictName" | "overallVerdictScale"
>;

// A stored Level's Overall Verdict scale (a Json column), checked on read.
export function overallVerdictScaleOf(level: Pick<LevelRow, "overallVerdictScale">): RatingScale {
  return ratingScaleSchema.parse(level.overallVerdictScale);
}

export function toLevel(level: LevelRow): Level {
  return {
    id: level.id,
    name: level.name,
    position: level.position,
    overallVerdict: { name: level.overallVerdictName, scale: overallVerdictScaleOf(level) },
  };
}

// Every new Level starts with the default Overall Verdict.
export const defaultOverallVerdictData = {
  overallVerdictName: defaultVerdict.name,
  overallVerdictScale: defaultVerdict.scale,
} satisfies Pick<Prisma.LevelUncheckedCreateInput, "overallVerdictName" | "overallVerdictScale">;

// Locks the Collection's row for the rest of the transaction, so two changes
// to its Levels can't both read the same deepest Level. Returns false when
// the Collection is missing or the User isn't a member.
export async function lockCollection(tx: Prisma.TransactionClient, collectionId: string, userId: string) {
  const collection = await findMemberCollection(tx, collectionId, userId);
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

// For writers of an Item's values (Attributes and ratings): the share lock on
// the Level row also conflicts with field.setCondition's Level lock, so
// visibility is judged against conditions that can't change before commit.
// Take it before any Field lock, as everywhere that reads conditions.
export async function lockLevelForValueWrite(tx: Prisma.TransactionClient, levelId: string) {
  await lockLevelVerdict(tx, levelId, "share");
}

export const level = {
  rename: authed.level.rename.handler(async ({ input, context, errors }) => {
    const found = await findMemberLevel(prisma, input.id, context.user.id);
    if (!found) throw errors.NOT_FOUND();
    return toLevel(await prisma.level.update({ where: { id: found.id }, data: { name: input.name } }));
  }),

  updateVerdict: authed.level.updateVerdict.handler(async ({ input, context, errors }) => {
    return prisma.$transaction(async (tx) => {
      const found = await findMemberLevel(tx, input.id, context.user.id);
      if (!found) throw errors.NOT_FOUND();
      // rating.setOverall takes a share lock on the same row before reading
      // the scale, so no rating can land between this count and the update.
      await lockLevelVerdict(tx, found.id, "update");
      const current = await tx.level.findUniqueOrThrow({
        where: { id: found.id },
        select: { overallVerdictScale: true },
      });
      // Resending the current scale (say, alongside a rename) isn't a change.
      const currentScale = overallVerdictScaleOf(current);
      const scaleChanges = input.scale !== undefined && !sameRatingScale(currentScale, input.scale);
      if (scaleChanges) {
        // Only Overall Ratings with a Verdict: one with Rating field values
        // alone has nothing on this scale.
        const ratingCount = await tx.overallRating.count({
          where: { item: { levelId: found.id }, OR: [{ verdictNumber: { not: null } }, { verdictLabel: { not: null } }] },
        });
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
          ...defaultOverallVerdictData,
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
