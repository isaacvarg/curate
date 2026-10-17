import { type VerdictScale, verdictScaleSchema } from "@repo/shared";
import { parseNumberField } from "./verdict";

// A Verdict scale as typed into the Level settings form, before it's checked.
export type ScaleDraft =
  | { kind: "numeric"; min: string; max: string; step: string }
  // One label per line, worst first.
  | { kind: "labels"; labels: string };

export function toScaleDraft(scale: VerdictScale): ScaleDraft {
  if (scale.kind === "labels") return { kind: "labels", labels: scale.labels.join("\n") };
  return { kind: "numeric", min: String(scale.min), max: String(scale.max), step: String(scale.step) };
}

// The scale a draft describes, checked with the shared scale rules the
// server applies, or the first reason it isn't valid.
export function parseScaleDraft(draft: ScaleDraft): { scale: VerdictScale } | { error: string } {
  let candidate: VerdictScale;
  if (draft.kind === "labels") {
    const labels = draft.labels
      .split("\n")
      .map((label) => label.trim())
      .filter((label) => label !== "");
    candidate = { kind: "labels", labels };
  } else {
    const [min, max, step] = [parseNumberField(draft.min), parseNumberField(draft.max), parseNumberField(draft.step)];
    if (![min, max, step].every(Number.isFinite)) return { error: "Minimum, maximum and step must be numbers." };
    candidate = { kind: "numeric", min, max, step };
  }
  const parsed = verdictScaleSchema.safeParse(candidate);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "That isn't a valid scale." };
  return { scale: parsed.data };
}

// Common scales offered as one-tap starting points.
export const scalePresets: { title: string; scale: VerdictScale }[] = [
  { title: "★1–5", scale: { kind: "numeric", min: 1, max: 5, step: 1 } },
  { title: "Half stars", scale: { kind: "numeric", min: 0.5, max: 5, step: 0.5 } },
  { title: "1–10", scale: { kind: "numeric", min: 1, max: 10, step: 1 } },
  { title: "0–100", scale: { kind: "numeric", min: 0, max: 100, step: 1 } },
  { title: "Tiers F–S", scale: { kind: "labels", labels: ["F", "D", "C", "B", "A", "S"] } },
  { title: "Thumbs", scale: { kind: "labels", labels: ["Thumbs down", "Meh", "Thumbs up"] } },
];

// A short summary of a scale for the settings screen.
export function describeScale(scale: VerdictScale): string {
  if (scale.kind === "labels") return scale.labels.join(" < ");
  const range = `${scale.min}–${scale.max}`;
  return scale.step === 1 ? range : `${range} in steps of ${scale.step}`;
}

// Why level.updateVerdict refused a scale change (SCALE_LOCKED).
export function scaleLockedMessage(ratingCount: number): string {
  const one = ratingCount === 1;
  return (
    `This Level already has ${ratingCount} ${one ? "rating" : "ratings"}, so its scale is locked: ` +
    `changing it would change what ${one ? "that rating means" : "those ratings mean"}. ` +
    `Clear ${one ? "it" : "them"} to unlock the scale. You can still rename the Verdict.`
  );
}
