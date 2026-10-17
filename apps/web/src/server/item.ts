import type { BreadcrumbEntry, ItemDeletePreview } from "@repo/shared";
import type { Prisma } from "@/generated/prisma/client";
import { findMemberCollection, findMemberItem, memberOf } from "./access";
import { prisma } from "./db";
import { authed } from "./orpc";
import { lockCollection } from "./level";
import { ownOverallRating, ownOverallRatingSelect } from "./rating";

const itemSummarySelect = { id: true, name: true, levelId: true, parentId: true } as const;

// An Item summary with the caller's own Overall Rating.
function itemSummaryFor(userId: string) {
  return { ...itemSummarySelect, ...ownOverallRatingSelect(userId) } as const;
}

function withOverallRating<T extends { overallRatings: Parameters<typeof ownOverallRating>[0] }>(row: T) {
  const { overallRatings, ...rest } = row;
  return { ...rest, overallRating: ownOverallRating(overallRatings) };
}

// Sort key first (creation order by default); id breaks ties for keys set
// explicitly by a later slice.
const itemOrder = [{ sortKey: "asc" }, { id: "asc" }] satisfies Prisma.ItemOrderByWithRelationInput[];

// Walks up from the parent, one query per Level; Collections have only a
// handful of Levels. Returns top Level first. Run it in the same snapshot the
// Item was read in, so every ancestor is still there.
async function breadcrumbOf(db: Prisma.TransactionClient, parentId: string | null): Promise<BreadcrumbEntry[]> {
  const breadcrumb: BreadcrumbEntry[] = [];
  let nextId = parentId;
  while (nextId !== null) {
    const ancestor = await db.item.findUniqueOrThrow({
      where: { id: nextId },
      select: { id: true, name: true, levelId: true, parentId: true },
    });
    breadcrumb.unshift({ id: ancestor.id, name: ancestor.name, levelId: ancestor.levelId });
    nextId = ancestor.parentId;
  }
  return breadcrumb;
}

export const item = {
  create: authed.item.create.handler(async ({ input, context, errors }) => {
    return prisma.$transaction(async (tx) => {
      // The Collection lock keeps level.removeDeepest from removing the Level
      // between this check and the insert.
      if (!(await lockCollection(tx, input.collectionId, context.user.id))) throw errors.NOT_FOUND();
      const level = await tx.level.findFirst({ where: { id: input.levelId, collectionId: input.collectionId } });
      if (!level) throw errors.INVALID_STRUCTURE();

      // The database backs these rules too (see the Item model), but checking
      // here gives the caller a typed error instead of a constraint violation.
      let parent: { id: string; levelPosition: number } | null = null;
      if (level.position === 0) {
        if (input.parentId !== undefined) throw errors.INVALID_STRUCTURE();
      } else {
        if (input.parentId === undefined) throw errors.INVALID_STRUCTURE();
        // Locked for share so item.delete (which locks it for update) can't
        // remove the parent between this check and the insert. A parent being
        // deleted right now is waited for, then reads as missing.
        const [found] = await tx.$queryRaw<{ id: string; levelPosition: number }[]>`
          select id, "levelPosition" from item
          where id = ${input.parentId} and "collectionId" = ${input.collectionId}
            and "levelPosition" = ${level.position - 1}
          for share`;
        if (!found) throw errors.INVALID_STRUCTURE();
        parent = found;
      }

      const created = await tx.item.create({
        data: {
          collectionId: input.collectionId,
          levelId: level.id,
          levelPosition: level.position,
          parentId: parent?.id ?? null,
          parentLevelPosition: parent?.levelPosition ?? null,
          name: input.name,
        },
        select: itemSummarySelect,
      });
      // A new Item has no ratings yet.
      return { ...created, overallRating: null };
    });
  }),

  list: authed.item.list.handler(async ({ input, context, errors }) => {
    const collection = await findMemberCollection(prisma, input.collectionId, context.user.id);
    if (!collection) throw errors.NOT_FOUND();
    if (input.parentId !== undefined) {
      const parent = await prisma.item.findFirst({
        where: { id: input.parentId, collectionId: collection.id },
        select: { id: true },
      });
      if (!parent) throw errors.NOT_FOUND();
    }
    const rows = await prisma.item.findMany({
      // No parent means the top Level: only top-Level Items have no parent.
      where: { collectionId: collection.id, parentId: input.parentId ?? null },
      select: itemSummaryFor(context.user.id),
      orderBy: itemOrder,
    });
    return rows.map(withOverallRating);
  }),

  get: authed.item.get.handler(async ({ input, context, errors }) => {
    // Repeatable read: one snapshot for the Item and its ancestors, so an
    // ancestor deleted mid-request can't go missing from the breadcrumb.
    return prisma.$transaction(
      async (tx) => {
        const row = await tx.item.findFirst({
          where: { id: input.id, collection: memberOf(context.user.id) },
          select: { ...itemSummaryFor(context.user.id), collectionId: true, _count: { select: { children: true } } },
        });
        if (!row) throw errors.NOT_FOUND();
        const { _count, ...item } = withOverallRating(row);
        return { ...item, breadcrumb: await breadcrumbOf(tx, item.parentId), childCount: _count.children };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }),

  rename: authed.item.rename.handler(async ({ input, context, errors }) => {
    const found = await findMemberItem(prisma, input.id, context.user.id);
    if (!found) throw errors.NOT_FOUND();
    const row = await prisma.item.update({
      where: { id: found.id },
      data: { name: input.name },
      select: itemSummaryFor(context.user.id),
    });
    return withOverallRating(row);
  }),

  deletePreview: authed.item.deletePreview.handler(async ({ input, context, errors }) => {
    const found = await findMemberItem(prisma, input.id, context.user.id);
    if (!found) throw errors.NOT_FOUND();
    return deletePreviewOf(prisma, found.id);
  }),

  delete: authed.item.delete.handler(async ({ input, context, errors }) => {
    await prisma.$transaction(async (tx) => {
      const found = await findMemberItem(tx, input.id, context.user.id);
      if (!found) throw errors.NOT_FOUND();
      // Inserting a child takes a key-share lock on its parent, so this keeps
      // a new child from appearing between the check and the delete.
      await tx.$queryRaw`select id from item where id = ${found.id} for update`;
      if (!input.confirmed) {
        const preview = await deletePreviewOf(tx, found.id);
        if (preview.descendantCount > 0) throw errors.CONFIRMATION_REQUIRED({ data: preview });
      }
      // Descendants and Overall Ratings cascade.
      await tx.item.delete({ where: { id: found.id } });
    });
  }),
};

// Finds the Item's descendants walking down one Level per query (Collections
// have only a handful of Levels).
async function deletePreviewOf(db: Prisma.TransactionClient, itemId: string): Promise<ItemDeletePreview> {
  const descendantIds: string[] = [];
  let parentIds = [itemId];
  while (parentIds.length > 0) {
    const children = await db.item.findMany({ where: { parentId: { in: parentIds } }, select: { id: true } });
    parentIds = children.map((child) => child.id);
    descendantIds.push(...parentIds);
  }
  // Every Collection Member's, since all of them go with the Items.
  const overallRatingCount = await db.overallRating.count({ where: { itemId: { in: [itemId, ...descendantIds] } } });
  return { descendantCount: descendantIds.length, overallRatingCount };
}
