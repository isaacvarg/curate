import { describe, expect, it } from "vitest";
import {
  type Expression,
  type ExpressionLevel,
  type ExpressionNode,
  evaluateExpression,
  type ItemValues,
  validateExpression,
} from "./expression";
import { defaultVerdict } from "./verdict";

const level: ExpressionLevel = {
  fields: [
    { id: "abv", kind: "attribute", name: "ABV", position: 0, config: { type: "number", unit: "%", min: 0, max: 60 } },
    {
      id: "genre",
      kind: "attribute",
      name: "Genre",
      position: 1,
      config: {
        type: "singleChoice",
        options: [
          { id: "fic", label: "Fiction" },
          { id: "non", label: "Non-fiction" },
          { id: "poe", label: "Poetry" },
        ],
      },
    },
    {
      id: "tags",
      kind: "attribute",
      name: "Tags",
      position: 2,
      config: {
        type: "multipleChoice",
        options: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ],
      },
    },
    { id: "organic", kind: "attribute", name: "Organic", position: 3, config: { type: "yesNo" } },
    { id: "notes", kind: "attribute", name: "Notes", position: 4, config: { type: "text" } },
    { id: "released", kind: "attribute", name: "Released", position: 5, config: { type: "date" } },
    { id: "plot", kind: "rating", name: "Plot", position: 6, scale: { kind: "numeric", min: 1, max: 5, step: 1 } },
    { id: "feel", kind: "rating", name: "Feel", position: 7, scale: { kind: "labels", labels: ["Meh", "Good", "Great"] } },
  ],
  verdict: defaultVerdict,
};

const wrap = (root: ExpressionNode): Expression => ({ version: 1, root });

const attr = (fieldId: string) => ({ type: "attribute", fieldId }) as const;
const rating = (fieldId: string) => ({ type: "rating", fieldId }) as const;
const verdict = { type: "verdict" } as const;
const num = (value: number) => ({ type: "number", value }) as const;
const text = (value: string) => ({ type: "text", value }) as const;
const date = (value: string) => ({ type: "date", value }) as const;
const bool = (value: boolean) => ({ type: "boolean", value }) as const;
const option = (optionId: string) => ({ type: "option", optionId }) as const;
const options = (...optionIds: string[]) => ({ type: "options", optionIds }) as const;

type Ref = ReturnType<typeof attr> | ReturnType<typeof rating> | typeof verdict;
type Lit = ReturnType<typeof num> | ReturnType<typeof text> | ReturnType<typeof date> | ReturnType<typeof bool> | ReturnType<typeof option> | ReturnType<typeof options>;
const cmp = (op: "=" | "!=" | "<" | "<=" | ">" | ">=", left: Ref, right: Lit): ExpressionNode => ({
  type: "compare",
  op,
  left,
  right,
});
const set = (operand: Ref): ExpressionNode => ({ type: "isSet", operand });
const notSet = (operand: Ref): ExpressionNode => ({ type: "isNotSet", operand });
const not = (operand: ExpressionNode): ExpressionNode => ({ type: "not", operand });
const allOf = (...operands: ExpressionNode[]): ExpressionNode => ({ type: "allOf", operands });
const anyOf = (...operands: ExpressionNode[]): ExpressionNode => ({ type: "anyOf", operands });

const none: ItemValues = { attributes: {}, ratings: {} };
const run = (root: ExpressionNode, values: ItemValues) => evaluateExpression(wrap(root), values, level);

describe("comparison", () => {
  const values: ItemValues = { attributes: { abv: 6.5, released: "2024-03-01", organic: true, notes: "Hazy IPA", genre: "fic" }, ratings: {} };

  it.each([
    ["=", 6.5, true],
    ["=", 6, false],
    ["!=", 6, true],
    ["!=", 6.5, false],
    ["<", 7, true],
    ["<", 6.5, false],
    ["<=", 6.5, true],
    [">", 6, true],
    [">", 6.5, false],
    [">=", 6.5, true],
    [">=", 7, false],
  ] as const)("number %s %s is %s", (op, literal, expected) => {
    expect(run(cmp(op, attr("abv"), num(literal)), values)).toBe(expected);
  });

  it("orders dates", () => {
    expect(run(cmp("<", attr("released"), date("2024-12-31")), values)).toBe(true);
    expect(run(cmp(">=", attr("released"), date("2024-03-02")), values)).toBe(false);
    expect(run(cmp("=", attr("released"), date("2024-03-01")), values)).toBe(true);
  });

  it("compares yes/no, text and a single choice for equality", () => {
    expect(run(cmp("=", attr("organic"), bool(true)), values)).toBe(true);
    expect(run(cmp("!=", attr("organic"), bool(true)), values)).toBe(false);
    expect(run(cmp("=", attr("notes"), text("Hazy IPA")), values)).toBe(true);
    expect(run(cmp("=", attr("genre"), option("fic")), values)).toBe(true);
    expect(run(cmp("!=", attr("genre"), option("fic")), values)).toBe(false);
  });

  it("compares numeric ratings and the Verdict", () => {
    const rated: ItemValues = { attributes: {}, ratings: { plot: 4 }, verdict: 5 };
    expect(run(cmp(">=", rating("plot"), num(4)), rated)).toBe(true);
    expect(run(cmp(">", rating("plot"), num(4)), rated)).toBe(false);
    expect(run(cmp("=", verdict, num(5)), rated)).toBe(true);
  });

  it("orders label ratings by their position on the scale, worst first", () => {
    const rated: ItemValues = { attributes: {}, ratings: { feel: "Good" } };
    expect(run(cmp(">", rating("feel"), text("Meh")), rated)).toBe(true);
    expect(run(cmp("<", rating("feel"), text("Great")), rated)).toBe(true);
    expect(run(cmp(">=", rating("feel"), text("Great")), rated)).toBe(false);
    expect(run(cmp("=", rating("feel"), text("Good")), rated)).toBe(true);
  });
});

describe("membership and contains", () => {
  const values: ItemValues = { attributes: { genre: "fic", tags: ["a", "b"], notes: "Hazy IPA with Citra" }, ratings: {} };

  it("is any of: a single choice is one of the listed options", () => {
    expect(run({ type: "isAnyOf", left: attr("genre"), right: options("fic", "poe") }, values)).toBe(true);
    expect(run({ type: "isAnyOf", left: attr("genre"), right: options("non", "poe") }, values)).toBe(false);
  });

  it("includes any of / includes all of on a multiple choice", () => {
    expect(run({ type: "includesAnyOf", left: attr("tags"), right: options("b", "c") }, values)).toBe(true);
    expect(run({ type: "includesAnyOf", left: attr("tags"), right: options("c") }, values)).toBe(false);
    expect(run({ type: "includesAllOf", left: attr("tags"), right: options("a", "b") }, values)).toBe(true);
    expect(run({ type: "includesAllOf", left: attr("tags"), right: options("a", "c") }, values)).toBe(false);
  });

  it("text contains ignores case", () => {
    expect(run({ type: "contains", left: attr("notes"), right: text("citra") }, values)).toBe(true);
    expect(run({ type: "contains", left: attr("notes"), right: text("mosaic") }, values)).toBe(false);
  });

  it("matches by option id, so a renamed option still matches", () => {
    const renamed: ExpressionLevel = {
      ...level,
      fields: level.fields.map((f) =>
        f.id === "genre" && f.kind === "attribute" && f.config.type === "singleChoice"
          ? { ...f, config: { ...f.config, options: f.config.options.map((o) => (o.id === "fic" ? { ...o, label: "Novels" } : o)) } }
          : f,
      ),
    };
    const tree = wrap(cmp("=", attr("genre"), option("fic")));
    expect(evaluateExpression(tree, values, renamed)).toBe(true);
  });
});

describe("absent values", () => {
  // The contract: absent (never entered, or in a hidden field) makes every
  // comparison, membership and contains test false, and is-not-set true.
  const tests: [string, ExpressionNode][] = [
    ["=", cmp("=", attr("abv"), num(5))],
    ["!=", cmp("!=", attr("abv"), num(5))],
    ["<", cmp("<", attr("abv"), num(5))],
    ["<=", cmp("<=", attr("abv"), num(5))],
    [">", cmp(">", attr("abv"), num(5))],
    [">=", cmp(">=", attr("abv"), num(5))],
    ["= on text", cmp("=", attr("notes"), text("x"))],
    ["= on a choice", cmp("=", attr("genre"), option("fic"))],
    ["= on a rating", cmp("=", rating("plot"), num(3))],
    ["!= on the Verdict", cmp("!=", verdict, num(3))],
    ["is any of", { type: "isAnyOf", left: attr("genre"), right: options("fic") }],
    ["includes any of", { type: "includesAnyOf", left: attr("tags"), right: options("a") }],
    ["includes all of", { type: "includesAllOf", left: attr("tags"), right: options("a") }],
    ["contains", { type: "contains", left: attr("notes"), right: text("x") }],
  ];

  it.each(tests)("makes %s false", (_, node) => {
    expect(run(node, none)).toBe(false);
  });

  it("makes is not set true and is set false", () => {
    expect(run(notSet(attr("abv")), none)).toBe(true);
    expect(run(set(attr("abv")), none)).toBe(false);
    expect(run(notSet(verdict), none)).toBe(true);
    expect(run(notSet(rating("plot")), none)).toBe(true);
  });

  it("makes is set true and is not set false when a value exists", () => {
    const values: ItemValues = { attributes: { abv: 0, organic: false }, ratings: {} };
    expect(run(set(attr("abv")), values)).toBe(true);
    expect(run(set(attr("organic")), values)).toBe(true);
    expect(run(notSet(attr("abv")), values)).toBe(false);
  });

  it("treats a multiple choice with nothing picked as absent", () => {
    const values: ItemValues = { attributes: { tags: [] }, ratings: {} };
    expect(run(set(attr("tags")), values)).toBe(false);
    expect(run(notSet(attr("tags")), values)).toBe(true);
    expect(run({ type: "includesAllOf", left: attr("tags"), right: options("a") }, values)).toBe(false);
  });

  it("lets not invert an absent comparison to true", () => {
    expect(run(not(cmp("=", attr("abv"), num(5))), none)).toBe(true);
    expect(run(not(cmp("!=", attr("abv"), num(5))), none)).toBe(true);
    expect(run(not(notSet(attr("abv"))), none)).toBe(false);
  });

  it("treats a reference to a field that no longer exists as absent", () => {
    expect(run(cmp("=", attr("gone"), num(1)), none)).toBe(false);
    expect(run(notSet(attr("gone")), none)).toBe(true);
  });
});

describe("all of, any of and not", () => {
  const values: ItemValues = { attributes: { abv: 7 }, ratings: {} };
  const yes = cmp(">", attr("abv"), num(5));
  const no = cmp(">", attr("abv"), num(10));

  it("all of needs every operand", () => {
    expect(run(allOf(yes, yes), values)).toBe(true);
    expect(run(allOf(yes, no), values)).toBe(false);
  });

  it("any of needs one operand", () => {
    expect(run(anyOf(no, yes), values)).toBe(true);
    expect(run(anyOf(no, no), values)).toBe(false);
  });

  it("an empty all of is true and an empty any of is false", () => {
    expect(run(allOf(), none)).toBe(true);
    expect(run(anyOf(), none)).toBe(false);
  });

  it("not inverts, and nests", () => {
    expect(run(not(yes), values)).toBe(false);
    expect(run(not(no), values)).toBe(true);
    expect(run(not(not(yes)), values)).toBe(true);
  });
});

// The reasons a tree is rejected, by the first one reported.
const reasons = (tree: unknown, profile: "condition" | "filter" = "filter") => {
  const result = validateExpression(tree, level, profile);
  return result.success ? [] : result.issues.map((i) => i.reason);
};

describe("validation", () => {
  it("accepts every node type that fits", () => {
    const tree = wrap(
      allOf(
        cmp(">=", attr("abv"), num(5)),
        anyOf(not(cmp("=", attr("organic"), bool(true))), notSet(attr("notes"))),
        { type: "isAnyOf", left: attr("genre"), right: options("fic", "poe") },
        { type: "includesAllOf", left: attr("tags"), right: options("a") },
        { type: "contains", left: attr("notes"), right: text("hazy") },
        cmp("<", attr("released"), date("2025-01-31")),
        set(attr("abv")),
      ),
    );
    expect(validateExpression(tree, level, "condition")).toEqual({ success: true, expression: tree });
  });

  it("accepts empty all of and any of", () => {
    expect(validateExpression(wrap(allOf()), level, "condition").success).toBe(true);
    expect(validateExpression(wrap(anyOf()), level, "condition").success).toBe(true);
  });

  describe("format version", () => {
    it("rejects an unknown version with its own reason", () => {
      const result = validateExpression({ version: 2, root: allOf() }, level, "filter");
      expect(result).toEqual({ success: false, issues: [{ path: ["version"], reason: "unsupportedVersion", version: 2 }] });
    });

    it("rejects a tree with no version", () => {
      expect(reasons({ root: allOf() })).toEqual(["unsupportedVersion"]);
    });
  });

  describe("shape", () => {
    it.each([
      ["a non-object", "nope"],
      ["no root", { version: 1 }],
      ["an unknown node type", { version: 1, root: { type: "xor", operands: [] } }],
      ["a literal as the left operand", { version: 1, root: { type: "compare", op: "=", left: num(1), right: num(1) } }],
      ["a reference as the right operand", { version: 1, root: { type: "compare", op: "=", left: attr("abv"), right: attr("abv") } }],
      ["an unknown operator", { version: 1, root: { type: "compare", op: "~", left: attr("abv"), right: num(1) } }],
    ])("rejects %s as malformed", (_, tree) => {
      expect(reasons(tree)).toEqual(["malformed"]);
    });
  });

  describe("references", () => {
    it("rejects a reference to a deleted field", () => {
      const result = validateExpression(wrap(cmp("=", attr("gone"), num(1))), level, "condition");
      expect(result).toEqual({
        success: false,
        issues: [{ path: ["root", "left"], reason: "unknownField", fieldId: "gone" }],
      });
    });

    it("rejects an Attribute reference to a Rating field, and the reverse", () => {
      expect(reasons(wrap(cmp("=", attr("plot"), num(1))))).toEqual(["unknownField"]);
      expect(reasons(wrap(cmp("=", rating("abv"), num(1))))).toEqual(["unknownField"]);
    });

    it("rejects a reference to a deleted option", () => {
      const result = validateExpression(wrap(cmp("=", attr("genre"), option("gone"))), level, "condition");
      expect(result).toEqual({
        success: false,
        issues: [{ path: ["root", "right"], reason: "unknownOption", fieldId: "genre", optionId: "gone" }],
      });
      expect(reasons(wrap({ type: "includesAnyOf", left: attr("tags"), right: options("a", "gone") }))).toEqual(["unknownOption"]);
    });
  });

  describe("profiles", () => {
    const withRating = wrap(cmp(">=", rating("plot"), num(4)));
    const withVerdict = wrap(cmp(">=", verdict, num(4)));

    it("condition rejects Rating field and Verdict references anywhere in the tree", () => {
      expect(reasons(withRating, "condition")).toEqual(["referenceNotAllowed"]);
      expect(reasons(withVerdict, "condition")).toEqual(["referenceNotAllowed"]);
      expect(reasons(wrap(not(anyOf(withRating.root))), "condition")).toEqual(["referenceNotAllowed"]);
      expect(reasons(wrap(set(verdict)), "condition")).toEqual(["referenceNotAllowed"]);
    });

    it("filter accepts Attribute, Rating field and Verdict references", () => {
      expect(validateExpression(withRating, level, "filter").success).toBe(true);
      expect(validateExpression(withVerdict, level, "filter").success).toBe(true);
      expect(validateExpression(wrap(notSet(rating("plot"))), level, "filter").success).toBe(true);
      expect(validateExpression(wrap(cmp("=", attr("abv"), num(5))), level, "filter").success).toBe(true);
    });

    it("condition accepts Attribute references", () => {
      expect(validateExpression(wrap(cmp("=", attr("abv"), num(5))), level, "condition").success).toBe(true);
    });
  });

  describe("operators and types", () => {
    it.each([
      ["ordering text", cmp("<", attr("notes"), text("a"))],
      ["ordering yes/no", cmp(">", attr("organic"), bool(true))],
      ["ordering a single choice", cmp(">=", attr("genre"), option("fic"))],
      ["= on a multiple choice", cmp("=", attr("tags"), option("a"))],
      ["a text literal against a number", cmp("=", attr("abv"), text("5"))],
      ["a number literal against a date", cmp("=", attr("released"), num(5))],
      ["a number literal against label ratings", cmp("=", rating("feel"), num(1))],
      ["a text literal against numeric ratings", cmp("=", rating("plot"), text("4"))],
      ["a boolean literal against text", cmp("=", attr("notes"), bool(true))],
      ["an option literal against a number", cmp("=", attr("abv"), option("fic"))],
      ["a list literal in a comparison", cmp("=", attr("genre"), options("fic"))],
      ["is any of on a multiple choice", { type: "isAnyOf", left: attr("tags"), right: options("a") }],
      ["is any of on text", { type: "isAnyOf", left: attr("notes"), right: options("a") }],
      ["includes any of on a single choice", { type: "includesAnyOf", left: attr("genre"), right: options("fic") }],
      ["includes all of on a number", { type: "includesAllOf", left: attr("abv"), right: options("a") }],
      ["contains on a number", { type: "contains", left: attr("abv"), right: text("5") }],
      ["contains on a choice", { type: "contains", left: attr("genre"), right: text("fic") }],
    ] as [string, ExpressionNode][])("rejects %s with a type mismatch", (_, node) => {
      expect(reasons(wrap(node))).toEqual(["typeMismatch"]);
    });

    it("names the operator and the types in a mismatch", () => {
      const result = validateExpression(wrap(cmp("<", attr("notes"), text("a"))), level, "condition");
      expect(result).toEqual({
        success: false,
        issues: [{ path: ["root"], reason: "typeMismatch", operator: "<", subject: "text", literal: "text" }],
      });
    });

    it("rejects a bare reference or literal where a yes/no is needed", () => {
      expect(reasons({ version: 1, root: attr("organic") })).toEqual(["malformed"]);
    });
  });

  describe("literals and bounds", () => {
    it("rejects a number outside the Attribute's bounds, with its field", () => {
      const result = validateExpression(wrap(cmp(">", attr("abv"), num(100))), level, "condition");
      expect(result).toEqual({
        success: false,
        issues: [{ path: ["root", "right"], reason: "outOfBounds", fieldId: "abv", message: "Must be at most 60 %." }],
      });
      expect(reasons(wrap(cmp("<", attr("abv"), num(-1))))).toEqual(["outOfBounds"]);
    });

    it("accepts a number at the bounds", () => {
      expect(validateExpression(wrap(cmp("<=", attr("abv"), num(60))), level, "condition").success).toBe(true);
      expect(validateExpression(wrap(cmp(">=", attr("abv"), num(0))), level, "condition").success).toBe(true);
    });

    it("rejects a Rating or Verdict literal off its scale", () => {
      expect(reasons(wrap(cmp(">=", rating("plot"), num(6))))).toEqual(["outOfBounds"]);
      expect(reasons(wrap(cmp(">=", rating("plot"), num(2.5))))).toEqual(["outOfBounds"]);
      expect(reasons(wrap(cmp("=", verdict, num(0))))).toEqual(["outOfBounds"]);
      expect(reasons(wrap(cmp("=", rating("feel"), text("Okay"))))).toEqual(["outOfBounds"]);
    });

    it("accepts a label of the scale", () => {
      expect(validateExpression(wrap(cmp(">=", rating("feel"), text("Good"))), level, "filter").success).toBe(true);
    });

    it("rejects a date that isn't on the calendar", () => {
      expect(reasons(wrap(cmp("=", attr("released"), date("2024-02-30"))))).toEqual(["invalidLiteral"]);
    });

    it("rejects blank text and an empty option list", () => {
      expect(reasons(wrap(cmp("=", attr("notes"), text("  "))))).toEqual(["invalidLiteral"]);
      expect(reasons(wrap({ type: "contains", left: attr("notes"), right: text("") }))).toEqual(["invalidLiteral"]);
      expect(reasons(wrap({ type: "isAnyOf", left: attr("genre"), right: options() }))).toEqual(["invalidLiteral"]);
    });
  });

  it("reports every problem, with the path to each", () => {
    const result = validateExpression(
      wrap(allOf(cmp("=", attr("gone"), num(1)), cmp(">", attr("abv"), num(100)))),
      level,
      "condition",
    );
    expect(result).toMatchObject({
      success: false,
      issues: [
        { path: ["root", "operands", 0, "left"], reason: "unknownField" },
        { path: ["root", "operands", 1, "right"], reason: "outOfBounds" },
      ],
    });
  });
});
