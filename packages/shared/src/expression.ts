import { z } from "zod";
import type { Field, FieldValue } from "./field";
import { validateFieldValue } from "./field";
import type { RatingValue } from "./rating-scale";
import type { Verdict } from "./verdict";

// The one expression model (ADR 0002): a tree of typed nodes stored as JSON
// with a format version. This first part has only logical nodes, which
// conditions and filters use. Later slices add node types to the same tree
// under a new format version.
//
// A comparison, membership or contains test reads one reference on the left
// and one literal on the right; arithmetic and other operands arrive with the
// node types that need them.
//
// The rule for absent values is part of the model's contract. A value is
// absent when it was never entered, or sits in a hidden field (the caller
// leaves hidden values out of ItemValues). An absent value makes every
// comparison, membership and contains test false, and is-not-set true. `not`
// inverts the result, so "not (ABV > 5)" matches an Item with no ABV.

export const EXPRESSION_FORMAT_VERSION = 1;

export type Reference =
  | { type: "attribute"; fieldId: string }
  | { type: "rating"; fieldId: string }
  | { type: "verdict" };

export type TextLiteral = { type: "text"; value: string };
export type OptionsLiteral = { type: "options"; optionIds: string[] };

export type Literal =
  | TextLiteral
  | { type: "number"; value: number }
  | { type: "date"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "option"; optionId: string }
  | OptionsLiteral;

export type CompareOperator = "=" | "!=" | "<" | "<=" | ">" | ">=";

export type ExpressionNode =
  | { type: "compare"; op: CompareOperator; left: Reference; right: Literal }
  | { type: "isAnyOf" | "includesAnyOf" | "includesAllOf"; left: Reference; right: OptionsLiteral }
  | { type: "contains"; left: Reference; right: TextLiteral }
  | { type: "isSet" | "isNotSet"; operand: Reference }
  | { type: "allOf" | "anyOf"; operands: ExpressionNode[] }
  | { type: "not"; operand: ExpressionNode };

export type Expression = { version: typeof EXPRESSION_FORMAT_VERSION; root: ExpressionNode };

const referenceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("attribute"), fieldId: z.string() }),
  z.object({ type: z.literal("rating"), fieldId: z.string() }),
  z.object({ type: z.literal("verdict") }),
]);

const textLiteralSchema = z.object({ type: z.literal("text"), value: z.string() });
const optionsLiteralSchema = z.object({ type: z.literal("options"), optionIds: z.array(z.string()) });

const literalSchema = z.discriminatedUnion("type", [
  textLiteralSchema,
  z.object({ type: z.literal("number"), value: z.number().finite() }),
  z.object({ type: z.literal("date"), value: z.string() }),
  z.object({ type: z.literal("boolean"), value: z.boolean() }),
  z.object({ type: z.literal("option"), optionId: z.string() }),
  optionsLiteralSchema,
]);

const nodeSchema: z.ZodType<ExpressionNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({
      type: z.literal("compare"),
      op: z.enum(["=", "!=", "<", "<=", ">", ">="]),
      left: referenceSchema,
      right: literalSchema,
    }),
    z.object({
      type: z.enum(["isAnyOf", "includesAnyOf", "includesAllOf"]),
      left: referenceSchema,
      right: optionsLiteralSchema,
    }),
    z.object({ type: z.literal("contains"), left: referenceSchema, right: textLiteralSchema }),
    z.object({ type: z.enum(["isSet", "isNotSet"]), operand: referenceSchema }),
    z.object({ type: z.enum(["allOf", "anyOf"]), operands: z.array(nodeSchema) }),
    z.object({ type: z.literal("not"), operand: nodeSchema }),
  ]),
);

export const expressionSchema: z.ZodType<Expression> = z.object({
  version: z.literal(EXPRESSION_FORMAT_VERSION),
  root: nodeSchema,
});

// What an expression reads from: a Level's Fields and its Verdict.
export type ExpressionLevel = { fields: readonly Field[]; verdict: Verdict };

// An Item's values, keyed by field id. A value that is missing is absent; the
// caller leaves out the values of hidden fields.
export type ItemValues = {
  attributes: Readonly<Record<string, FieldValue | undefined>>;
  ratings: Readonly<Record<string, RatingValue | undefined>>;
  verdict?: RatingValue;
};

// The Verdict is a Rating like any other, so it is read through a Field of
// the same shape.
const VERDICT_FIELD_ID = "verdict";

function verdictField(verdict: Verdict): Field {
  return { id: VERDICT_FIELD_ID, kind: "rating", name: verdict.name, position: 0, scale: verdict.scale };
}

function isAbsent(value: FieldValue | undefined): value is undefined {
  return value === undefined || (Array.isArray(value) && value.length === 0);
}

type Resolved = { field: Field | undefined; value: FieldValue | undefined };

function resolve(ref: Reference, item: ItemValues, level: ExpressionLevel): Resolved {
  if (ref.type === "verdict") return { field: verdictField(level.verdict), value: item.verdict };
  const field = level.fields.find((f) => f.id === ref.fieldId && f.kind === ref.type);
  const value = ref.type === "attribute" ? item.attributes[ref.fieldId] : item.ratings[ref.fieldId];
  return { field, value: field === undefined || isAbsent(value) ? undefined : value };
}

// How a value sorts against a literal: negative, zero or positive; or
// undefined when they can't be compared.
function order(field: Field, value: FieldValue, literal: Literal): number | undefined {
  if (field.kind === "rating") {
    const checked = validateFieldValue(field, literal.type === "number" || literal.type === "text" ? literal.value : undefined);
    if (!checked.success) return undefined;
    if (field.scale.kind === "labels") {
      const rank = field.scale.labels.indexOf(value as string);
      return rank < 0 ? undefined : rank - field.scale.labels.indexOf(checked.value as string);
    }
    return typeof value === "number" ? value - (checked.value as number) : undefined;
  }
  switch (literal.type) {
    case "number":
      return typeof value === "number" ? value - literal.value : undefined;
    case "date":
      return typeof value === "string" ? compareStrings(value, literal.value) : undefined;
    case "text":
      return typeof value === "string" ? compareStrings(value, literal.value.trim()) : undefined;
    case "option":
      return typeof value === "string" ? compareStrings(value, literal.optionId) : undefined;
    case "boolean":
      return typeof value === "boolean" ? Number(value) - Number(literal.value) : undefined;
    case "options":
      return undefined;
  }
}

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function holds(op: CompareOperator, difference: number): boolean {
  switch (op) {
    case "=":
      return difference === 0;
    case "!=":
      return difference !== 0;
    case "<":
      return difference < 0;
    case "<=":
      return difference <= 0;
    case ">":
      return difference > 0;
    case ">=":
      return difference >= 0;
  }
}

function evaluateNode(node: ExpressionNode, item: ItemValues, level: ExpressionLevel): boolean {
  switch (node.type) {
    case "compare": {
      const { field, value } = resolve(node.left, item, level);
      if (field === undefined || value === undefined) return false;
      const difference = order(field, value, node.right);
      return difference !== undefined && holds(node.op, difference);
    }
    case "isAnyOf": {
      const { value } = resolve(node.left, item, level);
      return typeof value === "string" && node.right.optionIds.includes(value);
    }
    case "includesAnyOf": {
      const { value } = resolve(node.left, item, level);
      return Array.isArray(value) && node.right.optionIds.some((id) => value.includes(id));
    }
    case "includesAllOf": {
      const { value } = resolve(node.left, item, level);
      return Array.isArray(value) && node.right.optionIds.every((id) => value.includes(id));
    }
    case "contains": {
      const { value } = resolve(node.left, item, level);
      return typeof value === "string" && value.toLowerCase().includes(node.right.value.trim().toLowerCase());
    }
    case "isSet":
      return resolve(node.operand, item, level).value !== undefined;
    case "isNotSet":
      return resolve(node.operand, item, level).value === undefined;
    case "allOf":
      return node.operands.every((operand) => evaluateNode(operand, item, level));
    case "anyOf":
      return node.operands.some((operand) => evaluateNode(operand, item, level));
    case "not":
      return !evaluateNode(node.operand, item, level);
  }
}

// Evaluates a validated expression against an Item's values. A reference to a
// field that no longer exists reads as absent.
export function evaluateExpression(expression: Expression, item: ItemValues, level: ExpressionLevel): boolean {
  return evaluateNode(expression.root, item, level);
}

// Which references a tree may hold. A condition decides whether a field
// shows, from the Item's Attributes alone. A filter narrows a list of Items,
// so it may also read the user's Rating fields and the Verdict.
export type ExpressionProfile = "condition" | "filter";

const ALLOWED_REFERENCES: Record<ExpressionProfile, readonly Reference["type"][]> = {
  condition: ["attribute"],
  filter: ["attribute", "rating", "verdict"],
};

// What a reference holds or a literal gives, in the terms operators fit to.
// A Rating on a numeric scale reads as a number, and on a label scale as text
// (its label).
export type ValueKind = Literal["type"];

export type ExpressionIssue = { path: (string | number)[] } & (
  | { reason: "unsupportedVersion"; version: unknown }
  | { reason: "malformed"; message: string }
  | { reason: "unknownField"; fieldId: string }
  | { reason: "referenceNotAllowed"; referenceType: Reference["type"]; profile: ExpressionProfile }
  | { reason: "typeMismatch"; operator: string; subject: ValueKind; literal: ValueKind }
  | { reason: "unknownOption"; fieldId: string; optionId: string }
  | { reason: "outOfBounds"; fieldId: string; message: string }
  | { reason: "invalidLiteral"; message: string }
);

export type ExpressionValidation =
  | { success: true; expression: Expression }
  | { success: false; issues: ExpressionIssue[] };

function subjectKind(field: Field): ValueKind {
  if (field.kind === "rating") return field.scale.kind === "labels" ? "text" : "number";
  switch (field.config.type) {
    case "text":
    case "number":
    case "date":
      return field.config.type;
    case "yesNo":
      return "boolean";
    case "singleChoice":
      return "option";
    case "multipleChoice":
      return "options";
  }
}

const ORDERED_KINDS: readonly ValueKind[] = ["number", "date"];

// Ratings are ordered on every scale, labels included (worst first).
function operatorFits(op: CompareOperator, field: Field, subject: ValueKind): boolean {
  if (subject === "options") return false;
  return op === "=" || op === "!=" || field.kind === "rating" || ORDERED_KINDS.includes(subject);
}

function optionIdsOf(field: Field): string[] {
  return field.kind === "attribute" && (field.config.type === "singleChoice" || field.config.type === "multipleChoice")
    ? field.config.options.map((o) => o.id)
    : [];
}

function checkLiteral(field: Field, literal: Literal, path: (string | number)[]): ExpressionIssue[] {
  switch (literal.type) {
    case "boolean":
      return [];
    case "option":
    case "options": {
      const ids = literal.type === "option" ? [literal.optionId] : literal.optionIds;
      if (ids.length === 0) return [{ path, reason: "invalidLiteral", message: "Pick at least one option." }];
      const known = optionIdsOf(field);
      return ids.filter((id) => !known.includes(id)).map((optionId) => ({ path, reason: "unknownOption", fieldId: field.id, optionId }));
    }
    case "text":
    case "number":
    case "date": {
      const checked = validateFieldValue(field, literal.value);
      if (checked.success) return [];
      const bounded = field.kind === "rating" || literal.type === "number";
      return [
        bounded
          ? { path, reason: "outOfBounds", fieldId: field.id, message: checked.message }
          : { path, reason: "invalidLiteral", message: checked.message },
      ];
    }
  }
}

function checkReference(
  ref: Reference,
  profile: ExpressionProfile,
  level: ExpressionLevel,
  path: (string | number)[],
): { field: Field } | { issues: ExpressionIssue[] } {
  if (!ALLOWED_REFERENCES[profile].includes(ref.type)) {
    return { issues: [{ path, reason: "referenceNotAllowed", referenceType: ref.type, profile }] };
  }
  if (ref.type === "verdict") return { field: verdictField(level.verdict) };
  const field = level.fields.find((f) => f.id === ref.fieldId && f.kind === ref.type);
  if (field === undefined) return { issues: [{ path, reason: "unknownField", fieldId: ref.fieldId }] };
  return { field };
}

function checkNode(node: ExpressionNode, profile: ExpressionProfile, level: ExpressionLevel, path: (string | number)[]): ExpressionIssue[] {
  switch (node.type) {
    case "allOf":
    case "anyOf":
      return node.operands.flatMap((operand, i) => checkNode(operand, profile, level, [...path, "operands", i]));
    case "not":
      return checkNode(node.operand, profile, level, [...path, "operand"]);
    case "isSet":
    case "isNotSet": {
      const checked = checkReference(node.operand, profile, level, [...path, "operand"]);
      return "issues" in checked ? checked.issues : [];
    }
    default: {
      const checked = checkReference(node.left, profile, level, [...path, "left"]);
      if ("issues" in checked) return checked.issues;
      const subject = subjectKind(checked.field);
      const literal = node.right.type;
      const operator = node.type === "compare" ? node.op : node.type;
      const fits =
        node.type === "compare"
          ? operatorFits(node.op, checked.field, subject) && subject === literal
          : node.type === "isAnyOf"
            ? subject === "option"
            : node.type === "contains"
              ? subject === "text"
              : subject === "options";
      if (!fits) return [{ path, reason: "typeMismatch", operator, subject, literal }];
      return checkLiteral(checked.field, node.right, [...path, "right"]);
    }
  }
}

// Type-checks a stored tree against a Level's Fields: the format version is
// known, every reference exists and is allowed by the profile, operators fit
// the types they are applied to, and literals fit the type and bounds of what
// they are compared with. Reports every problem found, each with the path to
// its node. Choices are checked by option id, so renaming an option never
// invalidates a tree.
export function validateExpression(tree: unknown, level: ExpressionLevel, profile: ExpressionProfile): ExpressionValidation {
  if (typeof tree !== "object" || tree === null) {
    return { success: false, issues: [{ path: [], reason: "malformed", message: "An expression is an object." }] };
  }
  const version = (tree as { version?: unknown }).version;
  if (version !== EXPRESSION_FORMAT_VERSION) {
    return { success: false, issues: [{ path: ["version"], reason: "unsupportedVersion", version }] };
  }
  const parsed = expressionSchema.safeParse(tree);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      success: false,
      issues: [
        {
          path: (issue?.path ?? []).map((key) => (typeof key === "number" ? key : String(key))),
          reason: "malformed",
          message: issue?.message ?? "Malformed expression.",
        },
      ],
    };
  }
  const issues = checkNode(parsed.data.root, profile, level, ["root"]);
  return issues.length === 0 ? { success: true, expression: parsed.data } : { success: false, issues };
}
