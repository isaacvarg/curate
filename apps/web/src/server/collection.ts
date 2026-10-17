import { type Collection, type CollectionDeletePreview, defaultLevelName } from "@repo/shared";
import type { Prisma } from "@/generated/prisma/client";
import { findMemberCollection, memberOf } from "./access";
import { prisma } from "./db";
import { defaultOverallVerdictData, toLevel } from "./level";
import { authed } from "./orpc";

const collectionInclude = {
  levels: { orderBy: { position: "asc" } },
  members: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.CollectionInclude;

type CollectionRow = Prisma.CollectionGetPayload<{ include: typeof collectionInclude }>;

function toCollection(row: CollectionRow): Collection {
  return {
    id: row.id,
    name: row.name,
    levels: row.levels.map(toLevel),
    members: row.members.map(({ userId, role }) => ({ userId, role })),
  };
}

export const collection = {
  create: authed.collection.create.handler(async ({ input, context }) => {
    const levelNames = input.levels ?? [defaultLevelName];
    const row = await prisma.collection.create({
      data: {
        name: input.name,
        members: { create: { userId: context.user.id, role: "owner" } },
        levels: {
          create: levelNames.map((name, position) => ({ name, position, ...defaultOverallVerdictData })),
        },
      },
      include: collectionInclude,
    });
    return toCollection(row);
  }),

  list: authed.collection.list.handler(async ({ context }) => {
    return prisma.collection.findMany({
      where: memberOf(context.user.id),
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    });
  }),

  get: authed.collection.get.handler(async ({ input, context, errors }) => {
    const row = await prisma.collection.findFirst({
      where: { id: input.id, ...memberOf(context.user.id) },
      include: collectionInclude,
    });
    if (!row) throw errors.NOT_FOUND();
    return toCollection(row);
  }),

  rename: authed.collection.rename.handler(async ({ input, context, errors }) => {
    const found = await findMemberCollection(prisma, input.id, context.user.id);
    if (!found) throw errors.NOT_FOUND();
    return prisma.collection.update({
      where: { id: found.id },
      data: { name: input.name },
      select: { id: true, name: true },
    });
  }),

  deletePreview: authed.collection.deletePreview.handler(async ({ input, context, errors }) => {
    const found = await findMemberCollection(prisma, input.id, context.user.id);
    if (!found) throw errors.NOT_FOUND();
    return deletePreviewOf(prisma, found.id);
  }),

  delete: authed.collection.delete.handler(async ({ input, context, errors }) => {
    await prisma.$transaction(async (tx) => {
      const found = await findMemberCollection(tx, input.id, context.user.id);
      if (!found) throw errors.NOT_FOUND();
      if (!input.confirmed) {
        throw errors.CONFIRMATION_REQUIRED({ data: await deletePreviewOf(tx, found.id) });
      }
      // Levels, Items, Overall Ratings and memberships cascade.
      await tx.collection.delete({ where: { id: found.id } });
    });
  }),
};

async function deletePreviewOf(db: Prisma.TransactionClient, collectionId: string): Promise<CollectionDeletePreview> {
  const [itemCount, overallRatingCount] = await Promise.all([
    db.item.count({ where: { collectionId } }),
    db.overallRating.count({ where: { item: { collectionId } } }),
  ]);
  return { itemCount, overallRatingCount };
}
