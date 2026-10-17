import type { BreadcrumbEntry } from "@repo/shared";
import type { Prisma } from "@/generated/prisma/client";
import { memberOf } from "./collection";
import { prisma } from "./db";
import { authed } from "./orpc";

const itemSummarySelect = { id: true, name: true, levelId: true, parentId: true } as const;

// Sort key first (creation order by default); id breaks ties for keys set
// explicitly by a later slice.
const itemOrder = [{ sortKey: "asc" }, { id: "asc" }] satisfies Prisma.ItemOrderByWithRelationInput[];

// Walks up from the parent, one query per Level; Collections have only a
// handful of Levels. Returns top Level first.
async function breadcrumbOf(parentId: string | null): Promise<BreadcrumbEntry[]> {
  const breadcrumb: BreadcrumbEntry[] = [];
  let nextId = parentId;
  while (nextId !== null) {
    const ancestor = await prisma.item.findUniqueOrThrow({
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
    const collection = await prisma.collection.findFirst({
      where: { id: input.collectionId, ...memberOf(context.user.id) },
      select: { id: true },
    });
    if (!collection) throw errors.NOT_FOUND();
    const level = await prisma.level.findFirst({ where: { id: input.levelId, collectionId: collection.id } });
    if (!level) throw errors.INVALID_STRUCTURE();

    // The database backs these rules too (see the Item model), but checking
    // here gives the caller a typed error instead of a constraint violation.
    let parent: { id: string; levelPosition: number } | null = null;
    if (level.position === 0) {
      if (input.parentId !== undefined) throw errors.INVALID_STRUCTURE();
    } else {
      if (input.parentId === undefined) throw errors.INVALID_STRUCTURE();
      parent = await prisma.item.findFirst({
        where: { id: input.parentId, collectionId: collection.id, levelPosition: level.position - 1 },
        select: { id: true, levelPosition: true },
      });
      if (!parent) throw errors.INVALID_STRUCTURE();
    }

    return prisma.item.create({
      data: {
        collectionId: collection.id,
        levelId: level.id,
        levelPosition: level.position,
        parentId: parent?.id ?? null,
        parentLevelPosition: parent?.levelPosition ?? null,
        name: input.name,
      },
      select: itemSummarySelect,
    });
  }),

  list: authed.item.list.handler(async ({ input, context, errors }) => {
    const collection = await prisma.collection.findFirst({
      where: { id: input.collectionId, ...memberOf(context.user.id) },
      select: { id: true },
    });
    if (!collection) throw errors.NOT_FOUND();
    if (input.parentId !== undefined) {
      const parent = await prisma.item.findFirst({
        where: { id: input.parentId, collectionId: collection.id },
        select: { id: true },
      });
      if (!parent) throw errors.NOT_FOUND();
    }
    return prisma.item.findMany({
      // No parent means the top Level: only top-Level Items have no parent.
      where: { collectionId: collection.id, parentId: input.parentId ?? null },
      select: itemSummarySelect,
      orderBy: itemOrder,
    });
  }),

  get: authed.item.get.handler(async ({ input, context, errors }) => {
    const row = await prisma.item.findFirst({
      where: { id: input.id, collection: memberOf(context.user.id) },
      select: { ...itemSummarySelect, collectionId: true, _count: { select: { children: true } } },
    });
    if (!row) throw errors.NOT_FOUND();
    const { _count, ...item } = row;
    return { ...item, breadcrumb: await breadcrumbOf(item.parentId), childCount: _count.children };
  }),
};
