import { z } from "zod";

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

// Labels are ordered worst first, so a label's position is its rank.
const labelsScaleSchema = z.object({
  kind: z.literal("labels"),
  labels: z
    .array(z.string())
    .min(2, { message: "A label scale needs at least two labels." })
    .refine((labels) => new Set(labels).size === labels.length, { message: "Labels must be distinct." }),
});

export const verdictScaleSchema = z.discriminatedUnion("kind", [numericScaleSchema, labelsScaleSchema]);

export type VerdictScale = z.infer<typeof verdictScaleSchema>;

export type VerdictValue = number | string;

// Whether two scales would read stored values the same way. Compared by
// field, not by JSON, since a stored scale's key order isn't preserved.
export function sameVerdictScale(a: VerdictScale, b: VerdictScale): boolean {
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
export function verdictValueSchema(scale: VerdictScale): z.ZodType<VerdictValue> {
  if (scale.kind === "labels") {
    return z.string().refine((v) => scale.labels.includes(v), { message: "Pick one of the scale's labels." });
  }
  return z
    .number()
    .min(scale.min, { message: `Must be at least ${scale.min}.` })
    .max(scale.max, { message: `Must be at most ${scale.max}.` })
    .refine((v) => isWholeNumberOfSteps(v - scale.min, scale.step), {
      message: `Must be in steps of ${scale.step}.`,
    });
}

// Maps a value to 0 (worst) .. 1 (best), the common ground every comparison is
// built on (ADR 0004). Throws if the value isn't valid for the scale.
export function toUnitInterval(scale: VerdictScale, value: VerdictValue): number {
  const parsed = verdictValueSchema(scale).parse(value);
  if (scale.kind === "labels") {
    return scale.labels.indexOf(parsed as string) / (scale.labels.length - 1);
  }
  return ((parsed as number) - scale.min) / (scale.max - scale.min);
}

export type Verdict = { name: string; scale: VerdictScale };

// Pre-filled on every new rating form.
export const defaultVerdict = {
  name: "Overall",
  scale: { kind: "numeric", min: 1, max: 5, step: 1 },
} as const satisfies Verdict;
