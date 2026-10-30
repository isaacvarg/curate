import { plural } from "./plural";

// Why field.updateScale refused a scale change (SCALE_LOCKED).
export function ratingScaleLockedMessage(valueCount: number): string {
  const pick = plural(valueCount);
  return (
    `${valueCount} ${pick("value is", "values are")} already set for this Rating field, so its scale is locked: ` +
    `changing it would change what ${pick("that value means", "those values mean")}. You can still rename it.`
  );
}
