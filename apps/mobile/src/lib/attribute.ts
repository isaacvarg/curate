import {
  type AttributeConfig,
  type AttributeConfigInput,
  type AttributeField,
  attributeConfigInputSchema,
  type FieldValue,
  validateFieldValue,
} from "@repo/shared";
import { plural } from "./plural";
import { parseNumberField } from "./verdict";

// The six Attribute types, in the order they're offered.
export const attributeTypes: { value: AttributeConfig["type"]; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "singleChoice", label: "Single choice" },
  { value: "multipleChoice", label: "Multiple choice" },
  { value: "yesNo", label: "Yes or no" },
  { value: "date", label: "Date" },
];

// A one-line summary of an Attribute's type for lists.
export function describeAttribute(config: AttributeConfig): string {
  switch (config.type) {
    case "text":
      return "Text";
    case "yesNo":
      return "Yes or no";
    case "date":
      return "Date";
    case "singleChoice":
      return `Single choice: ${config.options.map((o) => o.label).join(", ")}`;
    case "multipleChoice":
      return `Multiple choice: ${config.options.map((o) => o.label).join(", ")}`;
    case "number": {
      const head = config.unit === undefined ? "Number" : `Number in ${config.unit}`;
      if (config.min !== undefined && config.max !== undefined) return `${head}, ${config.min}–${config.max}`;
      if (config.min !== undefined) return `${head}, at least ${config.min}`;
      if (config.max !== undefined) return `${head}, at most ${config.max}`;
      return head;
    }
  }
}

export type OptionDraft = { id?: string; label: string };

// An Attribute's type configuration as typed into the field editor, before
// it's checked. Options keep their ids so renaming one never changes what
// Items refer to.
export type AttributeDraft = {
  type: AttributeConfig["type"];
  unit: string;
  min: string;
  max: string;
  options: OptionDraft[];
};

export function toAttributeDraft(config?: AttributeConfig): AttributeDraft {
  const draft: AttributeDraft = { type: config?.type ?? "text", unit: "", min: "", max: "", options: [] };
  if (config?.type === "number") {
    return {
      ...draft,
      unit: config.unit ?? "",
      min: config.min === undefined ? "" : String(config.min),
      max: config.max === undefined ? "" : String(config.max),
    };
  }
  if (config?.type === "singleChoice" || config?.type === "multipleChoice") {
    return { ...draft, options: config.options.map((o) => ({ id: o.id, label: o.label })) };
  }
  return draft;
}

// The configuration a draft describes, checked with the shared rules the
// server applies, or the first reason it isn't valid.
export function parseAttributeDraft(draft: AttributeDraft): { config: AttributeConfigInput } | { error: string } {
  let candidate: unknown;
  if (draft.type === "number") {
    const [min, max] = [parseNumberField(draft.min), parseNumberField(draft.max)];
    const blank = (text: string) => text.trim() === "";
    if ((!blank(draft.min) && !Number.isFinite(min)) || (!blank(draft.max) && !Number.isFinite(max))) {
      return { error: "Minimum and maximum must be numbers." };
    }
    const unit = draft.unit.trim();
    candidate = {
      type: "number",
      ...(unit === "" ? {} : { unit }),
      ...(blank(draft.min) ? {} : { min }),
      ...(blank(draft.max) ? {} : { max }),
    };
  } else if (draft.type === "singleChoice" || draft.type === "multipleChoice") {
    const options = draft.options
      .filter((o) => o.label.trim() !== "")
      .map((o) => (o.id === undefined ? { label: o.label } : { id: o.id, label: o.label }));
    candidate = { type: draft.type, options };
  } else {
    candidate = { type: draft.type };
  }
  const parsed = attributeConfigInputSchema.safeParse(candidate);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "That isn't a valid Attribute." };
  return { config: parsed.data };
}

// Why field.updateConfig refused a type change (TYPE_LOCKED).
export function typeLockedMessage(valueCount: number): string {
  const pick = plural(valueCount);
  return (
    `${valueCount} ${pick("Item has a value", "Items have a value")} for this Attribute, so its type is locked: ` +
    `changing it would change what ${pick("that value means", "those values mean")}. ` +
    `Clear ${pick("it", "them")} to unlock the type. You can still rename it and change its unit, bounds and options.`
  );
}

// Why field.updateConfig refused a change within the type
// (CONFIG_CONFLICTS_WITH_VALUES).
export function conflictMessage(conflictCount: number): string {
  const pick = plural(conflictCount);
  return (
    `${conflictCount} ${pick("Item has a value", "Items have values")} that this change would leave outside the ` +
    `bounds or options. Change ${pick("that value", "those values")} first.`
  );
}

// What a value control edits while the Item is being filled in: text and
// numbers as typed, a date as "YYYY-MM-DD" (or "" for none), a single choice
// as an option id (or null), a multiple choice as option ids, yes/no as
// true/false (or null when unset).
export type ValueDraft = string | boolean | string[] | null;

export function toValueDraft(field: AttributeField, value: FieldValue | undefined): ValueDraft {
  switch (field.config.type) {
    case "text":
    case "date":
      return typeof value === "string" ? value : "";
    case "number":
      return typeof value === "number" ? String(value) : "";
    case "singleChoice":
      return typeof value === "string" ? value : null;
    case "multipleChoice":
      return Array.isArray(value) ? value : [];
    case "yesNo":
      return typeof value === "boolean" ? value : null;
  }
}

// The value a draft means: null to clear, or the value to send, checked with
// the shared Field rules (so the phone's messages are the server's).
export function fromValueDraft(field: AttributeField, draft: ValueDraft): { value: FieldValue | null } | { error: string } {
  let candidate: unknown = draft;
  if (typeof draft === "string") {
    const text = draft.trim();
    if (text === "") return { value: null };
    candidate = field.config.type === "number" ? parseNumberField(text) : text;
  }
  if (draft === null || (Array.isArray(draft) && draft.length === 0)) return { value: null };
  const result = validateFieldValue(field, candidate);
  return result.success ? { value: result.value } : { error: result.message };
}

function sameValue(a: FieldValue | null | undefined, b: FieldValue | null | undefined): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x) => b.includes(x));
  return (a ?? null) === (b ?? null);
}

// What to send to item.setAttributes: only the values whose draft differs
// from the saved one (null clears), or every draft that isn't valid by Field
// id, in which case nothing should be sent.
export function changedValues(
  fields: readonly AttributeField[],
  saved: Record<string, FieldValue>,
  drafts: Record<string, ValueDraft>,
): { values: Record<string, FieldValue | null> } | { errors: Record<string, string> } {
  const values: Record<string, FieldValue | null> = {};
  const errors: Record<string, string> = {};
  for (const field of fields) {
    if (!(field.id in drafts)) continue;
    const result = fromValueDraft(field, drafts[field.id] as ValueDraft);
    if ("error" in result) {
      errors[field.id] = result.error;
    } else if (!sameValue(result.value, saved[field.id])) {
      values[field.id] = result.value;
    }
  }
  return Object.keys(errors).length > 0 ? { errors } : { values };
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

// "YYYY-MM-DD" to a local-midnight Date for the date picker, or null.
export function parseIsoDate(text: string): Date | null {
  const match = ISO_DATE.exec(text);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

// The picker's local date back to "YYYY-MM-DD", never shifted by time zone.
export function formatIsoDate(date: Date): string {
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
