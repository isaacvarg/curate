import { type AttributeField, type ExpressionLevel, type Field, type FieldValue, visibleFields } from "@repo/shared";
import { fromValueDraft, type ValueDraft } from "./attribute";

// The Level's fields that show for an Item while its Attributes are being
// edited: judged by the drafts as typed, not the saved values, so fields
// appear and disappear before anything is saved. A draft that isn't a valid
// value yet (a half-typed number) leaves that Attribute at its saved value.
export function visibleFieldsWithDrafts(
  fields: readonly Field[],
  verdict: ExpressionLevel["verdict"],
  saved: Record<string, FieldValue>,
  drafts: Record<string, ValueDraft>,
): Field[] {
  const attributes: Record<string, FieldValue | undefined> = { ...saved };
  for (const field of fields) {
    if (field.kind !== "attribute" || !(field.id in drafts)) continue;
    const result = fromValueDraft(field as AttributeField, drafts[field.id] as ValueDraft);
    if ("error" in result) continue;
    attributes[field.id] = result.value ?? undefined;
  }
  return visibleFields({ fields, verdict }, { attributes, ratings: {} });
}
