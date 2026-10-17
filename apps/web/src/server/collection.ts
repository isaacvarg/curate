import { type Collection, defaultLevelName, defaultVerdict, type Level, verdictScaleSchema } from "@repo/shared";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { authed } from "./orpc";

// Every authorization check on a Collection goes through this: a User may
// reach a Collection only through a CollectionMember row, never an owner
// column. Use it in `where` clauses on Collection.
export function memberOf(userId: string) {
  return { members: { some: { userId } } } satisfies Prisma.CollectionWhereInput;
}

const collectionInclude = {
  levels: { orderBy: { position: "asc" } },
  members: { orderBy: { createdAt: "asc" } },
} satisfies Prisma.CollectionInclude;

type CollectionRow = Prisma.CollectionGetPayload<{ include: typeof collectionInclude }>;

type LevelRow = Pick<
  Prisma.LevelGetPayload<object>,
  "id" | "name" | "position" | "overallVerdictName" | "overallVerdictScale"
>;

export function toLevel(level: LevelRow): Level {
  return {
    id: level.id,
    name: level.name,
    position: level.position,
    overallVerdict: {
      name: level.overallVerdictName,
      scale: verdictScaleSchema.parse(level.overallVerdictScale),
    },
  };
}

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
          create: levelNames.map((name, position) => ({
            name,
            position,
            overallVerdictName: defaultVerdict.name,
            overallVerdictScale: defaultVerdict.scale,
          })),
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
};
