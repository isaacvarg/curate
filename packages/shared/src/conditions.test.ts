import { describe, expect, it } from "vitest";
import { detectConditionLoops, visibleFields } from "./conditions";
import type { Expression } from "./expression";
import type { AttributeField, Field } from "./field";
import { defaultVerdict } from "./verdict";

function when(fieldId: string, node: "isSet" | "yes" | "equals", value?: string): Expression {
  const left = { type: "attribute", fieldId } as const;
  if (node === "isSet") return { version: 1, root: { type: "isSet", operand: left } };
  if (node === "yes") return { version: 1, root: { type: "compare", op: "=", left, right: { type: "boolean", value: true } } };
  return { version: 1, root: { type: "compare", op: "=", left, right: { type: "text", value: value ?? "" } } };
}

function attr(id: string, config: AttributeField["config"], condition?: Expression, position = 0): AttributeField {
  return { id, kind: "attribute", name: id, position, config, ...(condition ? { condition } : {}) };
}

const verdict = defaultVerdict;

describe("detectConditionLoops", () => {
  it("accepts fields without conditions and acyclic conditions", () => {
    const fields: Field[] = [
      attr("a", { type: "yesNo" }),
      attr("b", { type: "text" }, when("a", "yes")),
      attr("c", { type: "text" }, when("b", "isSet")),
    ];
    expect(detectConditionLoops(fields)).toEqual([]);
  });

  it("rejects a field that depends on itself", () => {
    const fields: Field[] = [attr("a", { type: "text" }, when("a", "isSet"))];
    expect(detectConditionLoops(fields)).toEqual([{ reason: "conditionLoop", fieldIds: ["a"] }]);
  });

  it("rejects a direct loop, naming both fields", () => {
    const fields: Field[] = [
      attr("a", { type: "text" }, when("b", "isSet")),
      attr("b", { type: "text" }, when("a", "isSet")),
    ];
    const loops = detectConditionLoops(fields);
    expect(loops).toHaveLength(1);
    expect(loops[0]?.fieldIds.slice().sort()).toEqual(["a", "b"]);
  });

  it("rejects an indirect loop, naming every field in it but not bystanders", () => {
    const fields: Field[] = [
      attr("a", { type: "text" }, when("c", "isSet")),
      attr("b", { type: "text" }, when("a", "isSet")),
      attr("c", { type: "text" }, when("b", "isSet")),
      attr("d", { type: "text" }, when("a", "isSet")),
    ];
    const loops = detectConditionLoops(fields);
    expect(loops).toHaveLength(1);
    expect(loops[0]?.fieldIds.slice().sort()).toEqual(["a", "b", "c"]);
  });

  it("finds a loop through a nested condition", () => {
    const nested: Expression = {
      version: 1,
      root: { type: "not", operand: { type: "anyOf", operands: [when("b", "isSet").root, when("x", "isSet").root] } },
    };
    const fields: Field[] = [attr("a", { type: "text" }, nested), attr("b", { type: "text" }, when("a", "isSet"))];
    expect(detectConditionLoops(fields)).toHaveLength(1);
  });

  it("ignores references to fields that do not exist", () => {
    expect(detectConditionLoops([attr("a", { type: "text" }, when("gone", "isSet"))])).toEqual([]);
  });
});

describe("visibleFields", () => {
  const series: Field[] = [
    attr("part", { type: "yesNo" }, undefined, 0),
    attr("series", { type: "text" }, when("part", "yes"), 1),
    attr("volume", { type: "number" }, when("series", "isSet"), 2),
    attr("title", { type: "text" }, undefined, 3),
  ];
  const ids = (fields: readonly Field[]) => fields.map((f) => f.id);

  it("shows fields without a condition always", () => {
    const shown = visibleFields({ fields: series, verdict }, { attributes: {}, ratings: {} });
    expect(ids(shown)).toContain("part");
    expect(ids(shown)).toContain("title");
  });

  it("shows a conditional field only when its condition holds", () => {
    const level = { fields: series, verdict };
    expect(ids(visibleFields(level, { attributes: { part: true, series: "Dune" }, ratings: {} }))).toEqual([
      "part",
      "series",
      "volume",
      "title",
    ]);
    expect(ids(visibleFields(level, { attributes: { part: false }, ratings: {} }))).toEqual(["part", "title"]);
  });

  it("hides a whole chain when its root is hidden, treating hidden values as absent", () => {
    const level = { fields: series, verdict };
    const values = { attributes: { part: false, series: "Dune", volume: 2 }, ratings: {} };
    expect(ids(visibleFields(level, values))).toEqual(["part", "title"]);
  });

  it("lets isNotSet read a hidden field as not set", () => {
    const fields: Field[] = [
      attr("part", { type: "yesNo" }),
      attr("series", { type: "text" }, when("part", "yes")),
      attr("standalone", { type: "text" }, { version: 1, root: { type: "isNotSet", operand: { type: "attribute", fieldId: "series" } } }),
    ];
    const values = { attributes: { part: false, series: "Dune" }, ratings: {} };
    expect(ids(visibleFields({ fields, verdict }, values))).toEqual(["part", "standalone"]);
  });

  it("never discards or changes the values it was given", () => {
    const attributes = { part: false, series: "Dune", volume: 2 };
    const values = { attributes, ratings: {} };
    visibleFields({ fields: series, verdict }, values);
    expect(values.attributes).toBe(attributes);
    expect(attributes).toEqual({ part: false, series: "Dune", volume: 2 });
  });

  it("keeps the order fields were given in", () => {
    const reversed = series.slice().reverse();
    const shown = visibleFields({ fields: reversed, verdict }, { attributes: { part: true, series: "x" }, ratings: {} });
    expect(ids(shown)).toEqual(["title", "volume", "series", "part"]);
  });

  it("shows a Rating field whose condition holds", () => {
    const fields: Field[] = [
      attr("part", { type: "yesNo" }),
      { id: "r", kind: "rating", name: "R", position: 1, scale: { kind: "numeric", min: 1, max: 5, step: 1 }, condition: when("part", "yes") },
    ];
    expect(ids(visibleFields({ fields, verdict }, { attributes: { part: true }, ratings: {} }))).toEqual(["part", "r"]);
    expect(ids(visibleFields({ fields, verdict }, { attributes: {}, ratings: {} }))).toEqual(["part"]);
  });

  it("hides fields caught in a loop rather than failing", () => {
    const fields: Field[] = [
      attr("a", { type: "text" }, when("b", "isSet")),
      attr("b", { type: "text" }, when("a", "isSet")),
      attr("c", { type: "text" }),
    ];
    expect(ids(visibleFields({ fields, verdict }, { attributes: { a: "x", b: "y" }, ratings: {} }))).toEqual(["c"]);
  });
});
