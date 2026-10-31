import type { Field } from "@repo/shared";
import { describe, expect, it } from "vitest";
import { sortChoices, sortFor } from "./item-search";

const fields: Field[] = [
  { id: "abv", kind: "attribute", name: "ABV", position: 0, config: { type: "number", unit: "%" } },
  { id: "brewery", kind: "attribute", name: "Brewery", position: 1, config: { type: "text" } },
  { id: "brewed", kind: "attribute", name: "Brewed", position: 2, config: { type: "date" } },
  { id: "aroma", kind: "rating", name: "Aroma", position: 3, scale: { kind: "numeric", min: 1, max: 5, step: 1 } },
];

describe("sortChoices", () => {
  it("offers name, the Verdict, then number and date Attributes in field order", () => {
    expect(sortChoices(fields, "Overall")).toEqual([
      { value: "name", label: "Name" },
      { value: "verdict", label: "Overall" },
      { value: "attribute:abv", label: "ABV" },
      { value: "attribute:brewed", label: "Brewed" },
    ]);
  });
});

describe("sortFor", () => {
  it("turns a choice and a direction into the sort the API takes", () => {
    expect(sortFor("name", "asc")).toEqual({ by: "name", direction: "asc" });
    expect(sortFor("verdict", "desc")).toEqual({ by: "verdict", direction: "desc" });
    expect(sortFor("attribute:abv", "desc")).toEqual({ by: "attribute", fieldId: "abv", direction: "desc" });
  });

  it("leaves the order alone when nothing is chosen", () => {
    expect(sortFor(null, "asc")).toBeUndefined();
  });
});
