import { evaluateExpression, type ExpressionLevel, type ExpressionNode, expressionSchema, type ItemValues } from "./expression";
import type { Field, FieldValue } from "./field";

// The two Level-wide questions about conditions (ADR 0002), answered here so
// the phone and the server agree. A condition is an expression tree that reads
// Attributes. A condition that can't be read as an expression counts as no
// condition; validateExpression is what rejects it on the way in.

// The fields a loop runs through, in the order the Level lists them.
export type ConditionLoop = { reason: "conditionLoop"; fieldIds: string[] };

function attributeIdsRead(node: ExpressionNode): string[] {
  switch (node.type) {
    case "allOf":
    case "anyOf":
      return node.operands.flatMap(attributeIdsRead);
    case "not":
      return attributeIdsRead(node.operand);
    case "isSet":
    case "isNotSet":
      return node.operand.type === "attribute" ? [node.operand.fieldId] : [];
    default:
      return node.left.type === "attribute" ? [node.left.fieldId] : [];
  }
}

// For each field with a condition, the Attributes that condition reads. Only
// fields that exist in the Level count.
function dependencies(fields: readonly Field[]): Map<string, string[]> {
  const known = new Set(fields.filter((f) => f.kind === "attribute").map((f) => f.id));
  const result = new Map<string, string[]>();
  for (const field of fields) {
    const parsed = field.condition === undefined ? undefined : expressionSchema.safeParse(field.condition);
    if (parsed?.success) result.set(field.id, [...new Set(attributeIdsRead(parsed.data.root))].filter((id) => known.has(id)));
  }
  return result;
}

function reachableFrom(start: string, edges: Map<string, string[]>): Set<string> {
  const seen = new Set<string>();
  const pending = [...(edges.get(start) ?? [])];
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(...(edges.get(id) ?? []));
  }
  return seen;
}

// Finds every group of fields whose conditions depend on each other, directly
// or through other Attributes, including a field that reads itself. One entry
// per group; an empty list means the Level's conditions are sound.
export function detectConditionLoops(fields: readonly Field[]): ConditionLoop[] {
  const edges = dependencies(fields);
  const reach = new Map<string, Set<string>>();
  for (const id of edges.keys()) reach.set(id, reachableFrom(id, edges));
  const loops: ConditionLoop[] = [];
  const placed = new Set<string>();
  for (const field of fields) {
    if (placed.has(field.id) || !reach.get(field.id)?.has(field.id)) continue;
    const members = fields.filter((f) => f.id === field.id || (reach.get(field.id)?.has(f.id) && reach.get(f.id)?.has(field.id)));
    for (const member of members) placed.add(member.id);
    loops.push({ reason: "conditionLoop", fieldIds: members.map((f) => f.id) });
  }
  return loops;
}

// Which of a Level's Fields show for an Item, in the order given. A field
// without a condition always shows. An Attribute hidden by its own condition
// reads as absent in the conditions that read it, so what depends on it hides
// too. The Item's values are only read, never changed: hidden values stay
// stored. The Verdict is not a Field here; it always shows. Fields caught in a
// loop hide, so a bad Level can't hang the screen.
export function visibleFields(level: ExpressionLevel, item: ItemValues): Field[] {
  const edges = dependencies(level.fields);
  const conditions = new Map<string, Field>();
  for (const field of level.fields) if (edges.has(field.id)) conditions.set(field.id, field);
  const shown = new Map<string, boolean>();
  const inProgress = new Set<string>();

  const isShown = (id: string): boolean => {
    const known = shown.get(id);
    if (known !== undefined) return known;
    const field = conditions.get(id);
    if (field === undefined) return true;
    if (inProgress.has(id)) return false;
    inProgress.add(id);
    const attributes: Record<string, FieldValue | undefined> = { ...item.attributes };
    for (const dep of edges.get(id) ?? []) if (!isShown(dep)) attributes[dep] = undefined;
    inProgress.delete(id);
    const parsed = expressionSchema.safeParse(field.condition);
    const result = parsed.success && evaluateExpression(parsed.data, { ...item, attributes }, level);
    shown.set(id, result);
    return result;
  };

  return level.fields.filter((field) => isShown(field.id));
}
