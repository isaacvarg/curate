import { type VerdictScale, type VerdictValue, verdictValueSchema } from "@repo/shared";

// Up to this many whole stars from 1 reads naturally as a star row.
const MAX_STARS = 10;

// Beyond this many values (0–10 has 11), a row of chips gets unwieldy and a
// stepper with a number field takes over.
const MAX_CHOICES = 11;

type NumericScale = Extract<VerdictScale, { kind: "numeric" }>;

function isStarScale(scale: VerdictScale): boolean {
  return scale.kind === "numeric" && scale.min === 1 && scale.step === 1 && scale.max <= MAX_STARS;
}

function stepCount(scale: NumericScale): number {
  return Math.round((scale.max - scale.min) / scale.step);
}

// The value `steps` steps above the minimum, rounded so decimal steps (0.1)
// don't show binary drift like 0.30000000000000004.
function valueAt(scale: NumericScale, steps: number): number {
  return Number((scale.min + steps * scale.step).toFixed(10));
}

export type VerdictOptions =
  | { kind: "stars" | "choices"; values: VerdictValue[] }
  // Too many values to list: step through them or type one in.
  | { kind: "stepper" };

// What a Verdict control offers for a scale: a star row for whole-star scales
// like the default ★1–5, one choice per value for other small scales (each
// step of a numeric scale, or each label, worst first), and a stepper for
// large numeric scales like 0–100.
export function verdictOptions(scale: VerdictScale): VerdictOptions {
  if (scale.kind === "labels") return { kind: "choices", values: [...scale.labels] };
  const count = stepCount(scale) + 1;
  if (count > MAX_CHOICES) return { kind: "stepper" };
  const values = Array.from({ length: count }, (_, i) => valueAt(scale, i));
  return { kind: isStarScale(scale) ? "stars" : "choices", values };
}

// One step up (+1) or down (-1) from `current`, held within the scale. With
// no value yet, a stepper starts from the middle of the scale.
export function stepVerdict(scale: NumericScale, current: number | null, direction: 1 | -1): number {
  const last = stepCount(scale);
  if (current === null) return valueAt(scale, Math.round(last / 2));
  const steps = Math.round((current - scale.min) / scale.step) + direction;
  return valueAt(scale, Math.min(last, Math.max(0, steps)));
}

// A typed-in Verdict, checked with the same rules the server uses.
export function parseVerdictInput(scale: NumericScale, text: string): { value: number } | { error: string } {
  const trimmed = text.trim();
  const number = trimmed === "" ? Number.NaN : Number(trimmed);
  if (!Number.isFinite(number)) return { error: "Enter a number." };
  const parsed = verdictValueSchema(scale).safeParse(number);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "That isn't on this scale." };
  return { value: number };
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
