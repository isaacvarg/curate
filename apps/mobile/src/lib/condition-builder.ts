import {
  type CompareOperator,
  type Expression,
  type ExpressionLevel,
  type ExpressionNode,
  type ExpressionProfile,
  expressionSchema,
  type Literal,
  type Reference,
} from "@repo/shared";

// The condition builder's model: rows of [subject] [operator] [value] joined by
// all of / any of, one level only. It covers a subset of what an Expression
// can say (ADR 0002). A stored tree outside that subset is not representable
// and must be shown read-only, never rewritten; parseCondition decides by
// building the rows back and checking the result is the same tree.

export type Operator =
  | "is"
  | "isNot"
  | "isAnyOf"
  | "includesAnyOf"
  | "includesAllOf"
  | CompareOperator
  | "contains"
  | "isYes"
  | "isNo"
  | "isSet"
  | "isNotSet";

// What a subject holds, in the terms the builder offers operators for. Rating
// scales read as numbers, or as ordered labels.
export type SubjectKind =
  | "text"
  | "number"
  | "date"
  | "yesNo"
  | "singleChoice"
  | "multipleChoice"
  | "ratingLabels";

export type Subject = {
  // "attribute:<id>", "rating:<id>" or "verdict".
  key: string;
  ref: Reference;
  name: string;
  kind: SubjectKind;
  // The unit of a number, shown after the value.
  unit?: string;
  // Choice options, or a label scale's labels (id = label).
  options: { id: string; label: string }[];
};

// A row as the user is editing it: any part may still be unset.
export type RowDraft = {
  subject: string | null;
  operator: Operator | null;
  // The text, number or date typed or picked, or a label of a label scale.
  value: string;
  optionIds: string[];
};

export type BuilderState = { mode: "allOf" | "anyOf"; rows: RowDraft[] };

export const emptyRow: RowDraft = { subject: null, operator: null, value: "", optionIds: [] };

function subjectKey(ref: Reference): string {
  return ref.type === "verdict" ? "verdict" : `${ref.type}:${ref.fieldId}`;
}

function ratingSubject(ref: Reference, name: string, scale: { kind: "numeric" } | { kind: "labels"; labels: string[] }): Subject {
  return scale.kind === "labels"
    ? { key: subjectKey(ref), ref, name, kind: "ratingLabels", options: scale.labels.map((l) => ({ id: l, label: l })) }
    : { key: subjectKey(ref), ref, name, kind: "number", options: [] };
}

// What the builder can compare, for a condition (Attributes only) or a filter
// (also Rating fields and the Verdict), in the Level's field order.
export function subjectsFor(level: ExpressionLevel, profile: ExpressionProfile): Subject[] {
  const subjects: Subject[] = [];
  for (const field of level.fields) {
    if (field.kind === "rating") {
      if (profile === "filter") subjects.push(ratingSubject({ type: "rating", fieldId: field.id }, field.name, field.scale));
      continue;
    }
    const ref: Reference = { type: "attribute", fieldId: field.id };
    const config = field.config;
    subjects.push({
      key: subjectKey(ref),
      ref,
      name: field.name,
      kind: config.type,
      unit: config.type === "number" ? config.unit : undefined,
      options: "options" in config ? config.options : [],
    });
  }
  if (profile === "filter") subjects.push(ratingSubject({ type: "verdict" }, level.verdict.name, level.verdict.scale));
  return subjects;
}

const COMPARISONS: { value: Operator; label: string }[] = [
  { value: "=", label: "=" },
  { value: "!=", label: "≠" },
  { value: "<", label: "<" },
  { value: "<=", label: "≤" },
  { value: ">", label: ">" },
  { value: ">=", label: "≥" },
];

const PRESENCE: { value: Operator; label: string }[] = [
  { value: "isSet", label: "is set" },
  { value: "isNotSet", label: "is not set" },
];

export function operatorsFor(subject: Subject): { value: Operator; label: string }[] {
  switch (subject.kind) {
    case "singleChoice":
      return [
        { value: "is", label: "is" },
        { value: "isNot", label: "is not" },
        { value: "isAnyOf", label: "is any of" },
        ...PRESENCE,
      ];
    case "multipleChoice":
      return [
        { value: "includesAnyOf", label: "includes any of" },
        { value: "includesAllOf", label: "includes all of" },
        ...PRESENCE,
      ];
    case "number":
    case "date":
    case "ratingLabels":
      return [...COMPARISONS, ...PRESENCE];
    case "text":
      return [{ value: "contains", label: "contains" }, ...PRESENCE];
    case "yesNo":
      return [{ value: "isYes", label: "is yes" }, { value: "isNo", label: "is no" }, ...PRESENCE];
  }
}

// The kind of value an operator takes after it.
export type ValueInput = "none" | "text" | "number" | "date" | "option" | "options" | "label";

export function valueInputFor(subject: Subject, operator: Operator): ValueInput {
  switch (operator) {
    case "isSet":
    case "isNotSet":
    case "isYes":
    case "isNo":
      return "none";
    case "is":
    case "isNot":
      return "option";
    case "isAnyOf":
    case "includesAnyOf":
    case "includesAllOf":
      return "options";
    case "contains":
      return "text";
    default:
      return subject.kind === "date" ? "date" : subject.kind === "ratingLabels" ? "label" : "number";
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function rowToNode(row: RowDraft, subjects: readonly Subject[]): ExpressionNode | null {
  const subject = subjects.find((s) => s.key === row.subject);
  if (!subject || row.operator === null) return null;
  const operator = row.operator;
  if (!operatorsFor(subject).some((o) => o.value === operator)) return null;
  const left = subject.ref;
  switch (operator) {
    case "isSet":
      return { type: "isSet", operand: left };
    case "isNotSet":
      return { type: "isNotSet", operand: left };
    case "isYes":
    case "isNo":
      return { type: "compare", op: "=", left, right: { type: "boolean", value: operator === "isYes" } };
    case "is":
    case "isNot": {
      const [optionId] = row.optionIds;
      if (row.optionIds.length !== 1 || optionId === undefined) return null;
      return { type: "compare", op: operator === "is" ? "=" : "!=", left, right: { type: "option", optionId } };
    }
    case "isAnyOf":
    case "includesAnyOf":
    case "includesAllOf":
      return row.optionIds.length === 0 ? null : { type: operator, left, right: { type: "options", optionIds: row.optionIds } };
    case "contains": {
      const value = row.value.trim();
      return value === "" ? null : { type: "contains", left, right: { type: "text", value } };
    }
    default: {
      let right: Literal;
      if (subject.kind === "date") {
        if (!DATE.test(row.value)) return null;
        right = { type: "date", value: row.value };
      } else if (subject.kind === "ratingLabels") {
        if (!subject.options.some((o) => o.id === row.value)) return null;
        right = { type: "text", value: row.value };
      } else {
        const number = row.value.trim() === "" ? Number.NaN : Number(row.value);
        if (!Number.isFinite(number)) return null;
        right = { type: "number", value: number };
      }
      return { type: "compare", op: operator, left, right };
    }
  }
}

// The Expression for the rows, or null while there are none or any is
// incomplete.
export function buildCondition(state: BuilderState, subjects: readonly Subject[]): Expression | null {
  if (state.rows.length === 0) return null;
  const operands: ExpressionNode[] = [];
  for (const row of state.rows) {
    const node = rowToNode(row, subjects);
    if (node === null) return null;
    operands.push(node);
  }
  return { version: 1, root: { type: state.mode, operands } };
}

function leafToRow(node: ExpressionNode, subjects: readonly Subject[]): RowDraft | null {
  const base = (ref: Reference) => subjects.find((s) => s.key === subjectKey(ref));
  switch (node.type) {
    case "allOf":
    case "anyOf":
    case "not":
      return null;
    case "isSet":
    case "isNotSet":
      return base(node.operand) ? { ...emptyRow, subject: subjectKey(node.operand), operator: node.type } : null;
  }
  const subject = base(node.left);
  if (!subject) return null;
  const row = { ...emptyRow, subject: subject.key };
  switch (node.type) {
    case "isAnyOf":
    case "includesAnyOf":
    case "includesAllOf":
      return { ...row, operator: node.type, optionIds: node.right.optionIds };
    case "contains":
      return { ...row, operator: "contains", value: node.right.value };
    case "compare": {
      const { right, op } = node;
      switch (right.type) {
        case "option":
          return { ...row, operator: op === "=" ? "is" : "isNot", optionIds: [right.optionId] };
        case "boolean":
          return { ...row, operator: right.value ? "isYes" : "isNo" };
        case "number":
          return { ...row, operator: op, value: String(right.value) };
        case "date":
        case "text":
          return { ...row, operator: op, value: right.value };
        default:
          return null;
      }
    }
  }
}

// Stable text for comparing trees regardless of key order.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

// The rows for a stored tree, or null when the builder can't represent it
// exactly: then the caller shows it read-only and leaves it alone.
export function parseCondition(tree: unknown, subjects: readonly Subject[]): BuilderState | null {
  const parsed = expressionSchema.safeParse(tree);
  if (!parsed.success) return null;
  const { root } = parsed.data;
  const leaves = root.type === "allOf" || root.type === "anyOf" ? root.operands : [root];
  const mode = root.type === "anyOf" ? "anyOf" : "allOf";
  const rows: RowDraft[] = [];
  for (const leaf of leaves) {
    const row = leafToRow(leaf, subjects);
    if (row === null) return null;
    rows.push(row);
  }
  const state: BuilderState = { mode, rows };
  const rebuilt = buildCondition(state, subjects);
  // A bare row reads as all of one, which is a different tree: still the same
  // meaning, so it is accepted, but only that one case.
  const expected = root.type === "allOf" || root.type === "anyOf" ? parsed.data : { ...parsed.data, root: { type: "allOf", operands: [root] } };
  return rebuilt !== null && canonical(rebuilt) === canonical(expected) ? state : null;
}

// Why field.setCondition refused a condition (INVALID_CONDITION or
// CONDITION_LOOP), or null for any other error.
export function conditionProblem(code: string, data: unknown): string | null {
  if (code === "CONDITION_LOOP") {
    const names = (data as { fieldNames: string[] }).fieldNames;
    return `These fields would depend on each other in a loop: ${names.join(", ")}.`;
  }
  if (code !== "INVALID_CONDITION") return null;
  const issue = (data as { issues: { reason: string; message?: string }[] }).issues[0];
  switch (issue?.reason) {
    case "referenceNotAllowed":
    case "unknownField":
      return "A condition can only use Attributes at this Level.";
    case "typeMismatch":
      return "That operator doesn't fit that field's type.";
    case "unknownOption":
      return "That option doesn't exist any more. Pick another.";
    case "outOfBounds":
    case "invalidLiteral":
      return issue.message ?? "That value isn't allowed.";
    default:
      return "That condition isn't valid.";
  }
}
