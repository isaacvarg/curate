import type { Field, FieldKind } from "@repo/shared";
import { moveItem } from "./attribute";

// The ids of all of a Level's Fields after moving one of `kind` one place up or
// down among the Fields of that kind. field.reorder wants every Field at the
// Level, so the other kind's Fields keep their slots.
export function orderAfterMove(
  all: readonly Pick<Field, "id" | "kind">[],
  kind: FieldKind,
  index: number,
  direction: 1 | -1,
): string[] {
  const moved = moveItem(
    all.filter((f) => f.kind === kind),
    index,
    direction,
  ).map((f) => f.id);
  return all.map((f) => (f.kind === kind ? (moved.shift() as string) : f.id));
}

// Why field.updateScale refused a scale change (SCALE_LOCKED).
export function ratingScaleLockedMessage(valueCount: number): string {
  const one = valueCount === 1;
  return (
    `${valueCount} ${one ? "value is" : "values are"} already set for this Rating field, so its scale is locked: ` +
    `changing it would change what ${one ? "that value means" : "those values mean"}. You can still rename it.`
  );
}
