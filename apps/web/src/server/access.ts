import type { Prisma } from "@/generated/prisma/client";

// Every authorization check goes through here: a User may reach a Collection,
// and the Levels and Items in it, only through a CollectionMember row, never
// an owner column. Each lookup returns null for a missing row and for one the
// User isn't a member of alike, so callers throw NOT_FOUND for both.

type Db = Prisma.TransactionClient;

// Use in `where` clauses on Collection.
export function memberOf(userId: string) {
  return { members: { some: { userId } } } satisfies Prisma.CollectionWhereInput;
}

export function findMemberCollection(db: Db, id: string, userId: string) {
  return db.collection.findFirst({ where: { id, ...memberOf(userId) }, select: { id: true } });
}

export function findMemberLevel(db: Db, id: string, userId: string) {
  return db.level.findFirst({ where: { id, collection: memberOf(userId) }, select: { id: true } });
}

export function findMemberItem(db: Db, id: string, userId: string) {
  return db.item.findFirst({ where: { id, collection: memberOf(userId) }, select: { id: true, levelId: true } });
}

export function findMemberField(db: Db, id: string, userId: string) {
  return db.field.findFirst({ where: { id, level: { collection: memberOf(userId) } } });
}
