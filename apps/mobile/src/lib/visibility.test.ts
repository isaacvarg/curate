import type { AttributeField, Expression, Field, RatingField } from "@repo/shared";
import { describe, expect, it } from "vitest";
import { visibleFieldsWithDrafts } from "./visibility";

const verdict = { name: "Verdict", scale: { kind: "numeric", min: 1, max: 5, step: 1 } } as const;
const condition: Expression = {
  version: 1,
  root: {
    type: "compare",
    op: "=",
    left: { type: "attribute", fieldId: "genre" },
    right: { type: "option", optionId: "fiction" },
  },
};
const genre: AttributeField = {
  id: "genre",
  kind: "attribute",
  name: "Genre",
  position: 0,
  config: {
    type: "singleChoice",
    options: [
      { id: "fiction", label: "Fiction" },
      { id: "non", label: "Non-fiction" },
    ],
  },
};
const setting: AttributeField = { id: "setting", kind: "attribute", name: "Setting", position: 1, config: { type: "text" }, condition };
const plot: RatingField = {
  id: "plot",
  kind: "rating",
  name: "Plot",
  position: 2,
  scale: { kind: "numeric", min: 1, max: 5, step: 1 },
  condition,
};
const fields: Field[] = [genre, setting, plot];
const ids = (list: Field[]) => list.map((f) => f.id);

describe("visibleFieldsWithDrafts", () => {
  it("follows the saved values when nothing is being edited", () => {
    expect(ids(visibleFieldsWithDrafts(fields, verdict, {}, {}))).toEqual(["genre"]);
    expect(ids(visibleFieldsWithDrafts(fields, verdict, { genre: "fiction" }, {}))).toEqual(["genre", "setting", "plot"]);
  });

  it("reveals fields as soon as a draft changes, before saving", () => {
    expect(ids(visibleFieldsWithDrafts(fields, verdict, {}, { genre: "fiction" }))).toEqual(["genre", "setting", "plot"]);
  });

  it("hides fields when a draft moves away, and a cleared draft counts as unset", () => {
    expect(ids(visibleFieldsWithDrafts(fields, verdict, { genre: "fiction" }, { genre: "non" }))).toEqual(["genre"]);
    expect(ids(visibleFieldsWithDrafts(fields, verdict, { genre: "fiction" }, { genre: null }))).toEqual(["genre"]);
  });

  it("keeps the saved value for a draft that isn't valid yet", () => {
    const pages: AttributeField = { id: "pages", kind: "attribute", name: "Pages", position: 3, config: { type: "number" } };
    const needs: Field = {
      ...setting,
      id: "needsPages",
      condition: { version: 1, root: { type: "compare", op: ">", left: { type: "attribute", fieldId: "pages" }, right: { type: "number", value: 10 } } },
    };
    const list = [pages, needs];
    expect(ids(visibleFieldsWithDrafts(list, verdict, { pages: 20 }, { pages: "2x" }))).toEqual(["pages", "needsPages"]);
    expect(ids(visibleFieldsWithDrafts(list, verdict, { pages: 20 }, { pages: "5" }))).toEqual(["pages"]);
  });
});
