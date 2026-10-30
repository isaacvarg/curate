import { z } from "zod";

// The bounded, ordered scale of a Rating: numeric with min, max and step, or
// labels ordered worst first. The Verdict is one Rating; Rating fields are
// others on scales of their own.

// Decimal steps (0.1, 0.5) aren't exact in binary floating point, so "is a
// whole number of steps" is checked with a tolerance.
const EPSILON = 1e-9;

function isWholeNumberOfSteps(distance: number, step: number): boolean {
  const steps = distance / step;
  return Math.abs(steps - Math.round(steps)) < EPSILON;
}

const numericScaleSchema = z
  .object({
    kind: z.literal("numeric"),
    min: z.number(),
    max: z.number(),
    step: z.number().positive({ message: "Step must be above zero." }),
  })
  .refine((s) => s.min < s.max, { message: "Minimum must be below maximum.", path: ["max"] })
  .refine((s) => !(s.min < s.max && s.step > 0) || isWholeNumberOfSteps(s.max - s.min, s.step), {
    message: "Step must divide the range evenly.",
    path: ["step"],
  });

const ratingLabelSchema = z
  .string()
  .trim()
  .min(1, { message: "Labels can't be blank." })
  .max(50, { message: "Labels must be at most 50 characters." });

// Labels are ordered worst first, so a label's position is its rank.
// Distinctness is checked after trimming, so "A" and " A" count as the same.
const labelsScaleSchema = z.object({
  kind: z.literal("labels"),
  labels: z
    .array(ratingLabelSchema)
    .min(2, { message: "A label scale needs at least two labels." })
    .refine((labels) => new Set(labels).size === labels.length, { message: "Labels must be distinct." }),
});

export const ratingScaleSchema = z.discriminatedUnion("kind", [numericScaleSchema, labelsScaleSchema]);

export type RatingScale = z.infer<typeof ratingScaleSchema>;

export type NumericScale = Extract<RatingScale, { kind: "numeric" }>;

export type RatingValue = number | string;

// Whether two scales would read stored values the same way. Compared by
// field, not by JSON, since a stored scale's key order isn't preserved.
export function sameRatingScale(a: RatingScale, b: RatingScale): boolean {
  if (a.kind === "labels" && b.kind === "labels") {
    return a.labels.length === b.labels.length && a.labels.every((label, i) => label === b.labels[i]);
  }
  if (a.kind === "numeric" && b.kind === "numeric") {
    return a.min === b.min && a.max === b.max && a.step === b.step;
  }
  return false;
}

// A numeric scale takes a number on one of its steps; a label scale takes one
// of its labels.
export function ratingValueSchema(scale: RatingScale): z.ZodType<RatingValue> {
  if (scale.kind === "labels") {
    return z.string().refine((v) => scale.labels.includes(v), { message: "Pick one of the scale's labels." });
  }
  return z
    .number()
    .min(scale.min, { message: `Must be at least ${scale.min}.` })
    .max(scale.max, { message: `Must be at most ${scale.max}.` })
    .refine((v) => isWholeNumberOfSteps(v - scale.min, scale.step), {
      message: `Must be in steps of ${scale.step}.`,
    })
    .transform((v) => snapToStep(scale, v));
}

// Accepted values are only within tolerance of a step, so store the step
// itself: min + k·step, rounded to the decimals of min and step to drop the
// float error that sum brings (0.1 + 0.2 → 0.3).
function snapToStep(scale: NumericScale, value: number): number {
  const steps = Math.round((value - scale.min) / scale.step);
  const decimals = Math.max(decimalPlaces(scale.min), decimalPlaces(scale.step));
  return Number((scale.min + steps * scale.step).toFixed(Math.min(decimals, 100)));
}

function decimalPlaces(n: number): number {
  const [mantissa = "", exponent] = String(n).split("e");
  const fraction = mantissa.split(".")[1]?.length ?? 0;
  return Math.max(0, fraction - Number(exponent ?? 0));
}

// Maps a value to 0 (worst) .. 1 (best), the common ground every comparison is
// built on (ADR 0004). Throws if the value isn't valid for the scale.
export function toUnitInterval(scale: RatingScale, value: RatingValue): number {
  const parsed = ratingValueSchema(scale).parse(value);
  if (scale.kind === "labels") {
    return scale.labels.indexOf(parsed as string) / (scale.labels.length - 1);
  }
  return ((parsed as number) - scale.min) / (scale.max - scale.min);
}
