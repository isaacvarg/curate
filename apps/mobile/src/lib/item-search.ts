import type { Field, ItemSearchSort } from "@repo/shared";

// The sort picker on a Level's browse screen: name, the Verdict, and each
// number or date Attribute. Text, choice and yes/no Attributes and Rating
// fields have no order the API sorts by.
export type SortChoice = { value: string; label: string };

const ATTRIBUTE_PREFIX = "attribute:";

export function sortChoices(fields: readonly Field[], verdictName: string): SortChoice[] {
  const attributes = fields.flatMap((field) =>
    field.kind === "attribute" && (field.config.type === "number" || field.config.type === "date")
      ? [{ value: `${ATTRIBUTE_PREFIX}${field.id}`, label: field.name }]
      : [],
  );
  return [{ value: "name", label: "Name" }, { value: "verdict", label: verdictName }, ...attributes];
}

// The sort for a chosen entry, or none (the Collection's own order) before one is chosen.
export function sortFor(choice: string | null, direction: ItemSearchSort["direction"]): ItemSearchSort | undefined {
  if (choice === null) return undefined;
  if (choice.startsWith(ATTRIBUTE_PREFIX)) return { by: "attribute", fieldId: choice.slice(ATTRIBUTE_PREFIX.length), direction };
  return { by: choice === "verdict" ? "verdict" : "name", direction };
}
