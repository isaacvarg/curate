import {
  type BreadcrumbEntry,
  evaluateExpression,
  type ExpressionLevel,
  type Field,
  type FieldValue,
  type ItemDeletePreview,
  type ItemSearchSort,
  type ItemSummary,
  type ItemValues,
  type RatingValue,
  toUnitInterval,
  validateExpression,
  validateFieldValue,
  visibleFields,
  visibleValues,
} from "@repo/shared";
import { Prisma } from "@/generated/prisma/client";
import { findMemberCollection, findMemberItem, memberOf } from "./access";
import { prisma } from "./db";
import { authed } from "./orpc";
import { attributeValuesOf, expressionLevelOf, type FieldRow, toField } from "./field";
import { lockCollection, lockLevelForValueWrite, overallVerdictScaleOf } from "./level";
import { ownOverallRating, ownOverallRatingSelect, ownOverallVerdict, ownOverallVerdictSelect } from "./rating";

const itemSummarySelect = { id: true, name: true, levelId: true, parentId: true } as const;

// An Item summary with the caller's own Verdict.
function itemSummaryFor(userId: string) {
  return { ...itemSummarySelect, ...ownOverallVerdictSelect(userId) } as const;
}

function withOverallVerdict<T extends { overallRatings: Parameters<typeof ownOverallVerdict>[0] }>(row: T) {
  const { overallRatings, ...rest } = row;
  return { ...rest, overallRating: ownOverallVerdict(overallRatings) };
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

// What sorting compares: a number, or a string (names, dates). Absent when the
// Item has no value to sort by.
type SortKey = number | string | undefined;

function compareKeys(a: NonNullable<SortKey>, b: NonNullable<SortKey>): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

type SearchErrors = Parameters<Parameters<typeof authed.item.search.handler>[0]>[0]["errors"];

// Every search is computed from the same values the shared evaluator reads
// (ADR 0002), so a filter can never disagree with a client that evaluates it:
// load the Level's Items with their Attributes and the caller's own Rating
// values, hide the values of hidden fields, evaluate, sort, then page.
async function searchItems(
  db: Prisma.TransactionClient,
  input: { collectionId: string; levelId: string; filter?: unknown; sort?: ItemSearchSort; limit: number; offset: number },
  userId: string,
  errors: SearchErrors,
) {
  const levelRow = await db.level.findFirst({
    where: { id: input.levelId, collectionId: input.collectionId, collection: memberOf(userId) },
  });
  if (!levelRow) throw errors.NOT_FOUND();
  const verdictScale = overallVerdictScaleOf(levelRow);
  const level: ExpressionLevel = {
    fields: await listLevelFields(db, levelRow.id),
    verdict: { name: levelRow.overallVerdictName, scale: verdictScale },
  };

  let filter: Parameters<typeof evaluateExpression>[0] | undefined;
  if (input.filter !== undefined && input.filter !== null) {
    const checked = validateExpression(input.filter, level, "filter");
    if (!checked.success) throw errors.INVALID_FILTER({ data: { issues: checked.issues } });
    filter = checked.expression;
  }

  const sort = input.sort;
  let sortField: Field | undefined;
  if (sort?.by === "attribute") {
    sortField = level.fields.find((f) => f.id === sort.fieldId && f.kind === "attribute");
    const type = sortField?.kind === "attribute" ? sortField.config.type : undefined;
    if (type !== "number" && type !== "date") throw errors.INVALID_SORT();
  }

  const rows = await db.item.findMany({
    where: { collectionId: input.collectionId, levelId: levelRow.id },
    select: {
      ...itemSummaryFor(userId),
      attributeValues: { select: { fieldId: true, value: true } },
      overallRatings: {
        where: { userId },
        select: {
          verdictNumber: true,
          verdictLabel: true,
          values: { select: { fieldId: true, valueNumber: true, valueLabel: true } },
        },
      },
    },
    orderBy: itemOrder,
  });

  const matches: { summary: ItemSummary; key: SortKey }[] = [];
  for (const row of rows) {
    const [own] = row.overallRatings;
    const values: ItemValues = {
      attributes: Object.fromEntries(row.attributeValues.map((v) => [v.fieldId, v.value as FieldValue])),
      ratings: Object.fromEntries((own?.values ?? []).map((v) => [v.fieldId, (v.valueLabel ?? v.valueNumber) as RatingValue])),
      ...((own?.verdictLabel ?? own?.verdictNumber) != null ? { verdict: (own?.verdictLabel ?? own?.verdictNumber) as RatingValue } : {}),
    };
    // A value in a hidden field is as good as not entered.
    const visible = visibleValues(level, values);
    if (filter && !evaluateExpression(filter, visible, level)) continue;

    let key: SortKey;
    if (sort?.by === "name") key = row.name.toLowerCase();
    else if (sort?.by === "verdict") key = visible.verdict === undefined ? undefined : toUnitInterval(verdictScale, visible.verdict);
    else if (sortField) {
      const value = visible.attributes[sortField.id];
      key = typeof value === "number" || typeof value === "string" ? value : undefined;
    }
    matches.push({
      summary: {
        id: row.id,
        name: row.name,
        levelId: row.levelId,
        parentId: row.parentId,
        overallRating: ownOverallVerdict(row.overallRatings),
      },
      key,
    });
  }

  if (sort) {
    const sign = sort.direction === "desc" ? -1 : 1;
    // Stable, so ties keep creation order. Absent values go last either way.
    matches.sort((a, b) => {
      if (a.key === undefined || b.key === undefined) return a.key === b.key ? 0 : a.key === undefined ? 1 : -1;
      return sign * compareKeys(a.key, b.key);
    });
  }

  return {
    items: matches.slice(input.offset, input.offset + input.limit).map((m) => m.summary),
    total: matches.length,
  };
}

async function listLevelFields(db: Prisma.TransactionClient, levelId: string): Promise<Field[]> {
  const rows = await db.field.findMany({ where: { levelId }, orderBy: { position: "asc" } });
  return rows.map(toField);
}

export const item = {
  search: authed.item.search.handler(async ({ input, context, errors }) => {
    // One snapshot, so the values and the Level's Fields agree.
    return prisma.$transaction((tx) => searchItems(tx, input, context.user.id, errors), {
      isolationLevel: "RepeatableRead",
    });
  }),

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
    return rows.map(withOverallVerdict);
  }),

  get: authed.item.get.handler(async ({ input, context, errors }) => {
    // Repeatable read: one snapshot for the Item and its ancestors, so an
    // ancestor deleted mid-request can't go missing from the breadcrumb.
    return prisma.$transaction(
      async (tx) => {
        const row = await tx.item.findFirst({
          where: { id: input.id, collection: memberOf(context.user.id) },
          select: {
            ...itemSummarySelect,
            ...ownOverallRatingSelect(context.user.id),
            collectionId: true,
            _count: { select: { children: true } },
          },
        });
        if (!row) throw errors.NOT_FOUND();
        const { _count, overallRatings, ...item } = row;
        const attributes = await attributeValuesOf(tx, item.id);
        const level = await expressionLevelOf(tx, item.levelId);
        const own = ownOverallRating(overallRatings);
        // A hidden Rating field's value reads as absent, though it stays stored.
        const fields = visibleFields(level, { attributes, ratings: own?.fields ?? {} });
        const shown = new Set(fields.map((f) => f.id));
        return {
          ...item,
          overallRating: own && {
            ...own,
            fields: Object.fromEntries(Object.entries(own.fields).filter(([id]) => shown.has(id))),
          },
          breadcrumb: await breadcrumbOf(tx, item.parentId),
          childCount: _count.children,
          attributes,
          fields,
        };
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
    return withOverallVerdict(row);
  }),

  setAttributes: authed.item.setAttributes.handler(async ({ input, context, errors }) => {
    return prisma.$transaction(async (tx) => {
      const found = await findMemberItem(tx, input.itemId, context.user.id);
      if (!found) throw errors.NOT_FOUND();
      const fieldIds = Object.keys(input.values);
      if (fieldIds.length === 0) return attributeValuesOf(tx, found.id);

      // Held until commit, so field.setCondition can't change what is visible
      // between the check below and the write.
      await lockLevelForValueWrite(tx, found.levelId);

      // Held until commit, so field.updateConfig can't change a type or narrow
      // bounds between the validation below and the write (nor count values
      // without these ones).
      const rows = await tx.$queryRaw<(FieldRow & { levelId: string })[]>`
        select id, kind, name, position, config, "levelId" from field
        where id in (${Prisma.join(fieldIds)}) for share`;
      const byId = new Map(rows.map((row) => [row.id, row]));

      const toWrite: [string, FieldValue][] = [];
      const toClear: string[] = [];
      for (const [fieldId, value] of Object.entries(input.values)) {
        // Only Attributes at the Item's own Level; anything else, including
        // other Collections' Fields, reads as unknown.
        const row = byId.get(fieldId);
        if (!row || row.kind !== "attribute" || row.levelId !== found.levelId) throw errors.INVALID_FIELD();
        if (value === null) {
          toClear.push(fieldId);
          continue;
        }
        const result = validateFieldValue(toField(row), value);
        if (!result.success) throw errors.INVALID_VALUE({ data: { fieldId, message: result.message } });
        toWrite.push([fieldId, result.value]);
      }

      // Judged by the Attributes as they will be after this save, so a save
      // that reveals a field may fill it. Clearing a hidden value is allowed.
      const after: Record<string, FieldValue> = { ...(await attributeValuesOf(tx, found.id)) };
      for (const fieldId of toClear) delete after[fieldId];
      for (const [fieldId, value] of toWrite) after[fieldId] = value;
      const visible = new Set(
        visibleFields(await expressionLevelOf(tx, found.levelId), { attributes: after, ratings: {} }).map((f) => f.id),
      );
      for (const [fieldId] of toWrite) if (!visible.has(fieldId)) throw errors.FIELD_HIDDEN({ data: { fieldId } });

      await tx.attributeValue.deleteMany({ where: { itemId: found.id, fieldId: { in: toClear } } });
      for (const [fieldId, value] of toWrite) {
        await tx.attributeValue.upsert({
          where: { itemId_fieldId: { itemId: found.id, fieldId } },
          create: { itemId: found.id, fieldId, levelId: found.levelId, value },
          update: { value },
        });
      }
      return attributeValuesOf(tx, found.id);
    });
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
