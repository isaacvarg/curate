import type { VerdictScale, VerdictValue } from "@repo/shared";

// Up to this many whole stars from 1 reads naturally as a star row.
const MAX_STARS = 10;

function isStarScale(scale: VerdictScale): boolean {
  return scale.kind === "numeric" && scale.min === 1 && scale.step === 1 && scale.max <= MAX_STARS;
}

// What a Verdict control offers for a scale: a star row for whole-star scales
// like the default ★1–5, otherwise one choice per value (each step of a
// numeric scale, or each label, worst first).
export function verdictOptions(scale: VerdictScale): { kind: "stars" | "choices"; values: VerdictValue[] } {
  if (scale.kind === "labels") return { kind: "choices", values: [...scale.labels] };
  const count = Math.round((scale.max - scale.min) / scale.step) + 1;
  // Rounded so decimal steps (0.1) don't show binary drift like 0.30000000000000004.
  const values = Array.from({ length: count }, (_, i) => Number((scale.min + i * scale.step).toFixed(10)));
  return { kind: isStarScale(scale) ? "stars" : "choices", values };
}

// A Verdict as shown next to an Item: filled and empty stars on a star scale,
// "value/max" on other numeric scales, or the label itself.
export function formatVerdict(scale: VerdictScale, value: VerdictValue): string {
  if (scale.kind === "labels") return String(value);
  if (isStarScale(scale)) {
    const filled = Number(value);
    return "★".repeat(filled) + "☆".repeat(scale.max - filled);
  }
  return `${value}/${scale.max}`;
}
