import { defaultVerdict } from "@repo/shared";
import type { Prisma } from "@/generated/prisma/client";
import { memberOf, toLevel } from "./collection";
import { prisma } from "./db";
import { authed } from "./orpc";

// Locks the Collection's row for the rest of the transaction, so two changes
// to its Levels can't both read the same deepest Level. Returns false when
// the Collection is missing or the User isn't a member.
async function lockCollection(tx: Prisma.TransactionClient, collectionId: string, userId: string) {
  const collection = await tx.collection.findFirst({
    where: { id: collectionId, ...memberOf(userId) },
    select: { id: true },
  });
  if (!collection) return false;
  await tx.$queryRaw`select id from collection where id = ${collection.id} for update`;
  return true;
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
      // the caller a typed error with the count. Item creation doesn't take
      // the Collection lock, so a racing create can still hit the constraint.
      if (deepest._count.items > 0) throw errors.LEVEL_HAS_ITEMS({ data: { itemCount: deepest._count.items } });
      await tx.level.delete({ where: { id: deepest.id } });
    });
  }),
};
