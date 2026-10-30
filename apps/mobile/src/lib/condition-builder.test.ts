import type { Expression, ExpressionLevel } from "@repo/shared";
import { describe, expect, it } from "vitest";
import {
  buildCondition,
  conditionProblem,
  operatorsFor,
  parseCondition,
  type RowDraft,
  subjectsFor,
} from "./condition-builder";

const level: ExpressionLevel = {
  verdict: { name: "Overall", scale: { kind: "numeric", min: 1, max: 5, step: 1 } },
  fields: [
    {
      id: "genre",
      kind: "attribute",
      name: "Genre",
      position: 0,
      config: { type: "singleChoice", options: [{ id: "f", label: "Fiction" }, { id: "n", label: "Non-fiction" }] },
    },
    { id: "tags", kind: "attribute", name: "Tags", position: 1, config: { type: "multipleChoice", options: [{ id: "a", label: "Epic" }] } },
    { id: "abv", kind: "attribute", name: "ABV", position: 2, config: { type: "number", unit: "%" } },
    { id: "note", kind: "attribute", name: "Note", position: 3, config: { type: "text" } },
    { id: "signed", kind: "attribute", name: "Signed", position: 4, config: { type: "yesNo" } },
    { id: "released", kind: "attribute", name: "Released", position: 5, config: { type: "date" } },
    { id: "plot", kind: "rating", name: "Plot", position: 6, scale: { kind: "numeric", min: 1, max: 5, step: 1 } },
  ],
};

const conditionSubjects = subjectsFor(level, "condition");
const filterSubjects = subjectsFor(level, "filter");
const row = (patch: Partial<RowDraft>): RowDraft => ({ subject: null, operator: null, value: "", optionIds: [], ...patch });

describe("subjectsFor", () => {
  it("offers only Attributes for a condition, and Rating fields and the Verdict for a filter", () => {
    expect(conditionSubjects.map((s) => s.name)).toEqual(["Genre", "Tags", "ABV", "Note", "Signed", "Released"]);
    expect(filterSubjects.map((s) => s.name)).toEqual(["Genre", "Tags", "ABV", "Note", "Signed", "Released", "Plot", "Overall"]);
  });
});

describe("operatorsFor", () => {
  const labels = (name: string) =>
    operatorsFor(conditionSubjects.find((s) => s.name === name)!).map((o) => o.label);

  it("matches the operators to each Attribute type", () => {
    expect(labels("Genre")).toEqual(["is", "is not", "is any of", "is set", "is not set"]);
    expect(labels("Tags")).toEqual(["includes any of", "includes all of", "is set", "is not set"]);
    expect(labels("ABV")).toEqual(["=", "≠", "<", "≤", ">", "≥", "is set", "is not set"]);
    expect(labels("Released")).toEqual(["=", "≠", "<", "≤", ">", "≥", "is set", "is not set"]);
    expect(labels("Note")).toEqual(["contains", "is set", "is not set"]);
    expect(labels("Signed")).toEqual(["is yes", "is no", "is set", "is not set"]);
  });
});

describe("buildCondition", () => {
  it("builds all of / any of from complete rows", () => {
    const rows = [
      row({ subject: "attribute:genre", operator: "is", optionIds: ["f"] }),
      row({ subject: "attribute:abv", operator: ">", value: "6" }),
      row({ subject: "attribute:signed", operator: "isNo" }),
      row({ subject: "attribute:tags", operator: "includesAllOf", optionIds: ["a"] }),
      row({ subject: "attribute:note", operator: "isNotSet" }),
    ];
    expect(buildCondition({ mode: "anyOf", rows }, conditionSubjects)).toEqual({
      version: 1,
      root: {
        type: "anyOf",
        operands: [
          { type: "compare", op: "=", left: { type: "attribute", fieldId: "genre" }, right: { type: "option", optionId: "f" } },
          { type: "compare", op: ">", left: { type: "attribute", fieldId: "abv" }, right: { type: "number", value: 6 } },
          { type: "compare", op: "=", left: { type: "attribute", fieldId: "signed" }, right: { type: "boolean", value: false } },
          { type: "includesAllOf", left: { type: "attribute", fieldId: "tags" }, right: { type: "options", optionIds: ["a"] } },
          { type: "isNotSet", operand: { type: "attribute", fieldId: "note" } },
        ],
      },
    });
  });

  it("maps is not to ≠ and is any of to a membership test", () => {
    const built = buildCondition(
      {
        mode: "allOf",
        rows: [
          row({ subject: "attribute:genre", operator: "isNot", optionIds: ["f"] }),
          row({ subject: "attribute:genre", operator: "isAnyOf", optionIds: ["f", "n"] }),
        ],
      },
      conditionSubjects,
    );
    expect(built?.root).toMatchObject({
      operands: [{ type: "compare", op: "!=" }, { type: "isAnyOf", right: { optionIds: ["f", "n"] } }],
    });
  });

  it("is null while any row is incomplete or there are no rows", () => {
    expect(buildCondition({ mode: "allOf", rows: [] }, conditionSubjects)).toBeNull();
    expect(buildCondition({ mode: "allOf", rows: [row({ subject: "attribute:abv" })] }, conditionSubjects)).toBeNull();
    expect(
      buildCondition({ mode: "allOf", rows: [row({ subject: "attribute:abv", operator: ">", value: "" })] }, conditionSubjects),
    ).toBeNull();
    expect(
      buildCondition({ mode: "allOf", rows: [row({ subject: "attribute:abv", operator: ">", value: "abc" })] }, conditionSubjects),
    ).toBeNull();
    expect(
      buildCondition({ mode: "allOf", rows: [row({ subject: "attribute:genre", operator: "is", optionIds: [] })] }, conditionSubjects),
    ).toBeNull();
  });

  it("reads Rating fields and the Verdict in a filter", () => {
    const built = buildCondition(
      {
        mode: "allOf",
        rows: [
          row({ subject: "rating:plot", operator: ">=", value: "4" }),
          row({ subject: "verdict", operator: "isNotSet" }),
        ],
      },
      filterSubjects,
    );
    expect(built?.root).toMatchObject({
      operands: [
        { type: "compare", op: ">=", left: { type: "rating", fieldId: "plot" } },
        { type: "isNotSet", operand: { type: "verdict" } },
      ],
    });
  });
});

describe("parseCondition", () => {

  it("round-trips a tree the builder made", () => {
    const tree = buildCondition(
      {
        mode: "allOf",
        rows: [
          row({ subject: "attribute:genre", operator: "isNot", optionIds: ["f"] }),
          row({ subject: "attribute:released", operator: "<", value: "2020-01-01" }),
          row({ subject: "attribute:note", operator: "contains", value: "x" }),
        ],
      },
      conditionSubjects,
    )!;
    const parsed = parseCondition(tree, conditionSubjects);
    expect(parsed).not.toBeNull();
    expect(buildCondition(parsed!, conditionSubjects)).toEqual(tree);
  });

  it("reads a single bare row as all of one", () => {
    const tree: Expression = {
      version: 1,
      root: { type: "isSet", operand: { type: "attribute", fieldId: "signed" } },
    };
    expect(parseCondition(tree, conditionSubjects)).toEqual({
      mode: "allOf",
      rows: [row({ subject: "attribute:signed", operator: "isSet" })],
    });
  });

  it("returns null for trees the builder can't represent", () => {
    const left = { type: "attribute", fieldId: "signed" } as const;
    const leaf = { type: "isSet", operand: left } as const;
    const unrepresentable: unknown[] = [
      { version: 1, root: { type: "not", operand: leaf } },
      { version: 1, root: { type: "allOf", operands: [{ type: "anyOf", operands: [leaf, leaf] }, leaf] } },
      { version: 1, root: { type: "allOf", operands: [] } },
      { version: 1, root: { type: "compare", op: "=", left: { type: "attribute", fieldId: "gone" }, right: { type: "boolean", value: true } } },
      { version: 1, root: { type: "compare", op: "!=", left, right: { type: "boolean", value: true } } },
      { version: 1, root: { type: "compare", op: "=", left: { type: "attribute", fieldId: "note" }, right: { type: "text", value: "x" } } },
      { version: 2, root: leaf },
      { nonsense: true },
    ];
    for (const tree of unrepresentable) expect(parseCondition(tree, conditionSubjects)).toBeNull();
  });
});

describe("conditionProblem", () => {
  it("names the fields in a loop", () => {
    expect(conditionProblem("CONDITION_LOOP", { fieldIds: ["a", "b"], fieldNames: ["Signed", "Pages"] })).toBe(
      "These fields would depend on each other in a loop: Signed, Pages.",
    );
  });

  it("explains the first issue of an invalid condition", () => {
    expect(conditionProblem("INVALID_CONDITION", { issues: [{ path: [], reason: "referenceNotAllowed" }] })).toBe(
      "A condition can only use Attributes at this Level.",
    );
    expect(conditionProblem("INVALID_CONDITION", { issues: [{ path: [], reason: "outOfBounds", message: "Must be at most 5." }] })).toBe(
      "Must be at most 5.",
    );
    expect(conditionProblem("INVALID_CONDITION", { issues: [{ path: [], reason: "typeMismatch" }] })).toBe(
      "That operator doesn't fit that field's type.",
    );
  });

  it("is null for anything else", () => {
    expect(conditionProblem("NOT_FOUND", undefined)).toBeNull();
  });
});
