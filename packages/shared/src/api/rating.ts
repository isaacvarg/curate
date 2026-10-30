import { z } from "zod";

// Any Verdict value's shape. Whether it's on the Item's Level's scale is
// checked against that scale with `ratingValueSchema` once the Level is known.
const verdictInputSchema = z.union([z.number(), z.string()]);

export const ratingSetOverallInputSchema = z.object({
  itemId: z.string(),
  verdict: verdictInputSchema,
});

export const ratingClearOverallInputSchema = z.object({ itemId: z.string() });

// The caller's Overall Rating of an Item. In this slice it's only the Verdict,
// as the raw value on the Level's Overall Verdict scale; `toUnitInterval`
// gives its 0–1 form.
export const overallRatingSchema = z.object({
  verdict: verdictInputSchema,
});

export type OverallRating = z.infer<typeof overallRatingSchema>;
