import { type OverallRating, type RatingValue, ratingValueSchema } from "@repo/shared";
import type { Prisma } from "@/generated/prisma/client";
import { findMemberItem } from "./access";
import { prisma } from "./db";
import { lockLevelVerdict, overallVerdictScaleOf } from "./level";
import { authed } from "./orpc";

// Selects only `userId`'s own Overall Rating of an Item; nest it in an Item
// select. Each User only ever sees their own.
export function ownOverallRatingSelect(userId: string) {
  return {
    overallRatings: { where: { userId }, select: { verdictNumber: true, verdictLabel: true } },
  } as const;
}

type StoredVerdict = { verdictNumber: number | null; verdictLabel: string | null };

// The raw stored value; exactly one column is set (overall_rating_verdict_check).
function toOverallRating(row: StoredVerdict): OverallRating {
  return { verdict: row.verdictLabel ?? (row.verdictNumber as number) };
}

// The caller's Overall Rating from an Item row selected with
// `ownOverallRatingSelect`, or null when unrated.
export function ownOverallRating(rows: StoredVerdict[]): OverallRating | null {
  const [row] = rows;
  return row ? toOverallRating(row) : null;
}

function toStoredVerdict(value: RatingValue): StoredVerdict {
  return typeof value === "string"
    ? { verdictNumber: null, verdictLabel: value }
    : { verdictNumber: value, verdictLabel: null };
}

// An Item the caller may rate: one in a Collection they're a member of.
function findRateableItem(db: Prisma.TransactionClient, itemId: string, userId: string) {
  return findMemberItem(db, itemId, userId);
}

export const rating = {
  setOverall: authed.rating.setOverall.handler(async ({ input, context, errors }) => {
    return prisma.$transaction(async (tx) => {
      const item = await findRateableItem(tx, input.itemId, context.user.id);
      if (!item) throw errors.NOT_FOUND();
      // Held until commit, so level.updateVerdict can't change the scale
      // between this check and the write (or count ratings without this one).
      await lockLevelVerdict(tx, item.levelId, "share");
      const level = await tx.level.findUniqueOrThrow({
        where: { id: item.levelId },
        select: { overallVerdictScale: true },
      });
      // The same value rules the phone uses, against this Item's Level's scale.
      const parsed = ratingValueSchema(overallVerdictScaleOf(level)).safeParse(input.verdict);
      if (!parsed.success) throw errors.VALUE_OUT_OF_SCALE();

      const verdict = toStoredVerdict(parsed.data);
      const row = await tx.overallRating.upsert({
        where: { itemId_userId: { itemId: item.id, userId: context.user.id } },
        create: { itemId: item.id, userId: context.user.id, ...verdict },
        update: verdict,
        select: { verdictNumber: true, verdictLabel: true },
      });
      return toOverallRating(row);
    });
  }),

  clearOverall: authed.rating.clearOverall.handler(async ({ input, context, errors }) => {
    const item = await findRateableItem(prisma, input.itemId, context.user.id);
    if (!item) throw errors.NOT_FOUND();
    await prisma.overallRating.deleteMany({ where: { itemId: item.id, userId: context.user.id } });
  }),
};
