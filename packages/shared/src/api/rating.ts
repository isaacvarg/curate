import { z } from "zod";

// Any rating value's shape. Whether it's on the right scale is checked against
// that scale with `ratingValueSchema` once the Level or Field is known.
const ratingValueInputSchema = z.union([z.number(), z.string()]);

// A User's Rating field values by Field id. A Field with no value is absent.
export const ratingFieldValuesSchema = z.record(z.string(), ratingValueInputSchema);

export type RatingFieldValues = z.infer<typeof ratingFieldValuesSchema>;

// Sets the Verdict and/or Rating field values of the caller's Overall Rating.
// The Verdict is optional: an Overall Rating exists as soon as either is set.
// Leaving the Verdict out keeps it; for the fields, a value sets it, `null`
// clears it, and Fields left out are untouched.
export const ratingSetOverallInputSchema = z
  .object({
    itemId: z.string(),
    verdict: ratingValueInputSchema.optional(),
    fields: z.record(z.string(), ratingValueInputSchema.nullable()).optional(),
  })
  .refine((input) => input.verdict !== undefined || Object.keys(input.fields ?? {}).length > 0, {
    message: "Set a Verdict or at least one Rating field.",
  });

export const ratingClearOverallInputSchema = z.object({ itemId: z.string() });

// What a list shows of the caller's Overall Rating: the Verdict as the raw
// value on the Level's Overall Verdict scale (`toUnitInterval` gives its 0–1
// form), or null when only Rating fields are set.
export const overallVerdictSchema = z.object({
  verdict: ratingValueInputSchema.nullable(),
});

// The caller's whole Overall Rating of an Item. It exists as soon as the
// Verdict or any Rating field value is set.
export const overallRatingSchema = overallVerdictSchema.extend({
  fields: ratingFieldValuesSchema,
});

export type OverallVerdict = z.infer<typeof overallVerdictSchema>;
export type OverallRating = z.infer<typeof overallRatingSchema>;
