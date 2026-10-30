import { type OverallRating, type OverallVerdict, type RatingValue, ratingScaleSchema, ratingValueSchema, visibleFields } from "@repo/shared";
import { Prisma } from "@/generated/prisma/client";
import { findMemberItem } from "./access";
import { attributeValuesOf, expressionLevelOf } from "./field";
import { prisma } from "./db";
import { lockLevelVerdict, overallVerdictScaleOf } from "./level";
import { authed } from "./orpc";

type Db = Prisma.TransactionClient;

// Selects only `userId`'s own Verdict of an Item; nest it in an Item select.
// Each User only ever sees their own.
export function ownOverallVerdictSelect(userId: string) {
  return {
    overallRatings: { where: { userId }, select: { verdictNumber: true, verdictLabel: true } },
  } as const;
}

// Likewise with the Rating field values, for one Item.
export function ownOverallRatingSelect(userId: string) {
  return {
    overallRatings: {
      where: { userId },
      select: {
        verdictNumber: true,
        verdictLabel: true,
        values: { select: { fieldId: true, valueNumber: true, valueLabel: true } },
      },
    },
  } as const;
}

type StoredVerdict = { verdictNumber: number | null; verdictLabel: string | null };
type StoredValue = { fieldId: string; valueNumber: number | null; valueLabel: string | null };

// The raw stored Verdict; at most one column is set (overall_rating_verdict_check).
function verdictOf(row: StoredVerdict): RatingValue | null {
  return row.verdictLabel ?? row.verdictNumber;
}

// The caller's Verdict from an Item row selected with `ownOverallVerdictSelect`,
// or null when they have no Overall Rating. An Overall Rating with Rating field
// values alone has a null `verdict`.
export function ownOverallVerdict(rows: StoredVerdict[]): OverallVerdict | null {
  const [row] = rows;
  return row ? { verdict: verdictOf(row) } : null;
}

function toOverallRating(row: StoredVerdict & { values: StoredValue[] }): OverallRating {
  return {
    verdict: verdictOf(row),
    // Exactly one column is set (overall_rating_value_check).
    fields: Object.fromEntries(row.values.map((v) => [v.fieldId, (v.valueLabel ?? v.valueNumber) as RatingValue])),
  };
}

// The caller's Overall Rating from an Item row selected with
// `ownOverallRatingSelect`, or null when unrated.
export function ownOverallRating(rows: Parameters<typeof toOverallRating>[0][]): OverallRating | null {
  const [row] = rows;
  return row ? toOverallRating(row) : null;
}

function toStored(value: RatingValue) {
  return typeof value === "string"
    ? { number: null, label: value }
    : { number: value, label: null };
}

// An Item the caller may rate: one in a Collection they're a member of.
function findRateableItem(db: Db, itemId: string, userId: string) {
  return findMemberItem(db, itemId, userId);
}

export const rating = {
  setOverall: authed.rating.setOverall.handler(async ({ input, context, errors }) => {
    return prisma.$transaction(async (tx) => {
      const item = await findRateableItem(tx, input.itemId, context.user.id);
      if (!item) throw errors.NOT_FOUND();

      // The same value rules the phone uses. Everything is checked before
      // anything is written, so a bad value leaves the rating as it was.
      let verdict: ReturnType<typeof toStored> | undefined;
      if (input.verdict !== undefined) {
        // Held until commit, so level.updateVerdict can't change the scale
        // between this check and the write (or count ratings without this one).
        await lockLevelVerdict(tx, item.levelId, "share");
        const level = await tx.level.findUniqueOrThrow({
          where: { id: item.levelId },
          select: { overallVerdictScale: true },
        });
        const parsed = ratingValueSchema(overallVerdictScaleOf(level)).safeParse(input.verdict);
        if (!parsed.success) throw errors.VALUE_OUT_OF_SCALE();
        verdict = toStored(parsed.data);
      }

      const toWrite: [string, ReturnType<typeof toStored>][] = [];
      const toClear: string[] = [];
      const fieldIds = Object.keys(input.fields ?? {});
      if (fieldIds.length > 0) {
        // Held until commit, so field.updateScale can't change a scale between
        // the validation below and the write (nor count values without these).
        const rows = await tx.$queryRaw<{ id: string; kind: string; levelId: string; config: unknown }[]>`
          select id, kind, "levelId", config from field
          where id in (${Prisma.join(fieldIds)}) for share`;
        const byId = new Map(rows.map((row) => [row.id, row]));
        const visible = new Set(
          visibleFields(await expressionLevelOf(tx, item.levelId), {
            attributes: await attributeValuesOf(tx, item.id),
            ratings: {},
          }).map((f) => f.id),
        );
        for (const [fieldId, value] of Object.entries(input.fields ?? {})) {
          // Only Rating fields at the Item's own Level; anything else,
          // including other Collections' Fields, reads as unknown.
          const row = byId.get(fieldId);
          if (!row || row.kind !== "rating" || row.levelId !== item.levelId) throw errors.INVALID_FIELD();
          if (value === null) {
            toClear.push(fieldId);
            continue;
          }
          if (!visible.has(fieldId)) throw errors.FIELD_HIDDEN({ data: { fieldId } });
          const parsed = ratingValueSchema(ratingScaleSchema.parse(row.config)).safeParse(value);
          if (!parsed.success) {
            throw errors.INVALID_VALUE({
              data: { fieldId, message: parsed.error.issues[0]?.message ?? "Invalid value." },
            });
          }
          toWrite.push([fieldId, toStored(parsed.data)]);
        }
      }

      const verdictData = verdict && { verdictNumber: verdict.number, verdictLabel: verdict.label };
      const overall = await tx.overallRating.upsert({
        where: { itemId_userId: { itemId: item.id, userId: context.user.id } },
        create: { itemId: item.id, userId: context.user.id, ...verdictData },
        update: { ...verdictData },
        select: { id: true },
      });
      await tx.overallRatingValue.deleteMany({ where: { overallRatingId: overall.id, fieldId: { in: toClear } } });
      for (const [fieldId, value] of toWrite) {
        const data = { valueNumber: value.number, valueLabel: value.label };
        await tx.overallRatingValue.upsert({
          where: { overallRatingId_fieldId: { overallRatingId: overall.id, fieldId } },
          create: { overallRatingId: overall.id, fieldId, ...data },
          update: data,
        });
      }

      const row = await tx.overallRating.findUniqueOrThrow({
        where: { id: overall.id },
        select: ownOverallRatingSelect(context.user.id).overallRatings.select,
      });
      // Clearing the last value of an Overall Rating with no Verdict leaves
      // nothing to rate: it stops existing.
      if (verdictOf(row) === null && row.values.length === 0) {
        await tx.overallRating.delete({ where: { id: overall.id } });
        return null;
      }
      return toOverallRating(row);
    });
  }),

  // The Rating field values go with the Overall Rating (cascade).
  clearOverall: authed.rating.clearOverall.handler(async ({ input, context, errors }) => {
    const item = await findRateableItem(prisma, input.itemId, context.user.id);
    if (!item) throw errors.NOT_FOUND();
    await prisma.overallRating.deleteMany({ where: { itemId: item.id, userId: context.user.id } });
  }),
};
