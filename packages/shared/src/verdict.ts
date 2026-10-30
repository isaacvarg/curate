import type { RatingScale } from "./rating-scale";

// The bottom-line Rating, on any Rating Scale.
export type Verdict = { name: string; scale: RatingScale };

// Pre-filled on every new rating form.
export const defaultVerdict = {
  name: "Overall",
  scale: { kind: "numeric", min: 1, max: 5, step: 1 },
} as const satisfies Verdict;
