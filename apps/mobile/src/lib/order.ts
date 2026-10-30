import type { Field, FieldKind } from "@repo/shared";

// `list` with the entry at `index` moved one place up (-1) or down (1); a
// move off either end changes nothing.
export function moveItem<T>(list: readonly T[], index: number, direction: 1 | -1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return [...list];
  const next = [...list];
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved as T);
  return next;
}

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
