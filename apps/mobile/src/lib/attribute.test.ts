import type { AttributeField } from "@repo/shared";
import { describe, expect, it } from "vitest";
import {
  changedValues,
  conflictMessage,
  describeAttribute,
  formatIsoDate,
  fromValueDraft,
  moveItem,
  parseAttributeDraft,
  parseIsoDate,
  toAttributeDraft,
  toValueDraft,
  typeLockedMessage,
} from "./attribute";

function field(id: string, config: AttributeField["config"]): AttributeField {
  return { id, kind: "attribute", name: id, position: 0, config };
}

const abv = field("abv", { type: "number", unit: "%", min: 0, max: 20 });
const style = field("style", {
  type: "singleChoice",
  options: [
    { id: "o1", label: "IPA" },
    { id: "o2", label: "Stout" },
  ],
});
const notes = field("notes", {
  type: "multipleChoice",
  options: [
    { id: "n1", label: "Citrus" },
    { id: "n2", label: "Pine" },
  ],
});

describe("parseAttributeDraft", () => {
  it("builds a number configuration with unit and bounds", () => {
    const draft = { ...toAttributeDraft(), type: "number" as const, unit: " % ", min: "0", max: "20" };

    expect(parseAttributeDraft(draft)).toEqual({ config: { type: "number", unit: "%", min: 0, max: 20 } });
  });

  it("leaves a blank unit and blank bounds out", () => {
    const draft = { ...toAttributeDraft(), type: "number" as const };

    expect(parseAttributeDraft(draft)).toEqual({ config: { type: "number" } });
  });

  it("asks for numbers when a bound isn't one", () => {
    const draft = { ...toAttributeDraft(), type: "number" as const, min: "low" };

    expect(parseAttributeDraft(draft)).toEqual({ error: "Minimum and maximum must be numbers." });
  });

  it("explains bounds the wrong way round", () => {
    const draft = { ...toAttributeDraft(), type: "number" as const, min: "10", max: "1" };

    expect(parseAttributeDraft(draft)).toEqual({ error: "Minimum must not be above maximum." });
  });

  it("keeps the ids of existing options and drops blank rows", () => {
    const draft = toAttributeDraft(style.config);
    draft.options = [...draft.options, { label: "  " }, { label: "Porter" }];

    expect(parseAttributeDraft(draft)).toEqual({
      config: {
        type: "singleChoice",
        options: [
          { id: "o1", label: "IPA" },
          { id: "o2", label: "Stout" },
          { label: "Porter" },
        ],
      },
    });
  });

  it("asks for an option when a choice has none", () => {
    expect(parseAttributeDraft({ ...toAttributeDraft(), type: "multipleChoice", options: [{ label: "" }] })).toEqual({
      error: "Add at least one option.",
    });
  });

  it("explains duplicate options", () => {
    const draft = { ...toAttributeDraft(), type: "singleChoice" as const, options: [{ label: "A" }, { label: "A" }] };

    expect(parseAttributeDraft(draft)).toEqual({ error: "Options must be distinct." });
  });

  it.each(["text", "yesNo", "date"] as const)("builds a %s configuration", (type) => {
    expect(parseAttributeDraft({ ...toAttributeDraft(), type })).toEqual({ config: { type } });
  });
});

describe("toAttributeDraft", () => {
  it("reads a configuration back into its fields", () => {
    expect(toAttributeDraft(abv.config)).toMatchObject({ type: "number", unit: "%", min: "0", max: "20" });
    expect(toAttributeDraft(style.config).options).toEqual([
      { id: "o1", label: "IPA" },
      { id: "o2", label: "Stout" },
    ]);
  });
});

describe("describeAttribute", () => {
  it.each([
    [{ type: "text" } as const, "Text"],
    [abv.config, "Number in %, 0–20"],
    [{ type: "number", min: 1 } as const, "Number, at least 1"],
    [{ type: "number", max: 5 } as const, "Number, at most 5"],
    [{ type: "number" } as const, "Number"],
    [style.config, "Single choice: IPA, Stout"],
    [notes.config, "Multiple choice: Citrus, Pine"],
    [{ type: "yesNo" } as const, "Yes or no"],
    [{ type: "date" } as const, "Date"],
  ])("summarises %o as %s", (config, text) => {
    expect(describeAttribute(config)).toBe(text);
  });
});

describe("messages", () => {
  it("explains the type lock with the count", () => {
    expect(typeLockedMessage(1)).toContain("1 Item has a value");
    expect(typeLockedMessage(3)).toContain("3 Items have a value");
  });

  it("explains a conflict with the count", () => {
    expect(conflictMessage(1)).toContain("1 Item");
    expect(conflictMessage(2)).toContain("2 Items");
  });
});

describe("value drafts", () => {
  it("reads a saved value into the draft its control edits", () => {
    expect(toValueDraft(abv, 5.5)).toBe("5.5");
    expect(toValueDraft(abv, undefined)).toBe("");
    expect(toValueDraft(style, "o1")).toBe("o1");
    expect(toValueDraft(style, undefined)).toBeNull();
    expect(toValueDraft(notes, ["n1"])).toEqual(["n1"]);
    expect(toValueDraft(notes, undefined)).toEqual([]);
    expect(toValueDraft(field("signed", { type: "yesNo" }), true)).toBe(true);
    expect(toValueDraft(field("signed", { type: "yesNo" }), undefined)).toBeNull();
  });

  it("turns a draft into the value to send, or null to clear", () => {
    expect(fromValueDraft(abv, " 5.5 ")).toEqual({ value: 5.5 });
    expect(fromValueDraft(abv, "")).toEqual({ value: null });
    expect(fromValueDraft(style, null)).toEqual({ value: null });
    expect(fromValueDraft(notes, [])).toEqual({ value: null });
    expect(fromValueDraft(notes, ["n2"])).toEqual({ value: ["n2"] });
    expect(fromValueDraft(field("signed", { type: "yesNo" }), false)).toEqual({ value: false });
    expect(fromValueDraft(field("brewery", { type: "text" }), "  RR ")).toEqual({ value: "RR" });
  });

  it("rejects a draft with the shared rule's message", () => {
    expect(fromValueDraft(abv, "65")).toEqual({ error: "Must be at most 20 %." });
    expect(fromValueDraft(abv, "strong")).toEqual({ error: "Enter a number." });
    expect(fromValueDraft(field("released", { type: "date" }), "2026-02-30")).toEqual({
      error: "Enter a valid date (YYYY-MM-DD).",
    });
  });
});

describe("changedValues", () => {
  const fields = [abv, style, notes];

  it("sends only what changed, clearing what was emptied", () => {
    const saved = { abv: 5, style: "o1" };
    const drafts = { abv: "5", style: null, notes: ["n1"] };

    expect(changedValues(fields, saved, drafts)).toEqual({ values: { style: null, notes: ["n1"] } });
  });

  it("sends nothing when nothing changed", () => {
    const saved = { abv: 5, notes: ["n1", "n2"] };
    const drafts = { abv: "5.0", style: null, notes: ["n2", "n1"] };

    expect(changedValues(fields, saved, drafts)).toEqual({ values: {} });
  });

  it("reports every invalid draft by field and sends nothing", () => {
    const drafts = { abv: "99", style: "o1", notes: [] };

    expect(changedValues(fields, {}, drafts)).toEqual({ errors: { abv: "Must be at most 20 %." } });
  });
});

describe("dates", () => {
  it("round-trips a calendar date without a time zone shift", () => {
    const date = parseIsoDate("2026-03-01");

    expect(date && [date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 2, 1]);
    expect(date && formatIsoDate(date)).toBe("2026-03-01");
  });

  it("returns null for text that isn't a date", () => {
    expect(parseIsoDate("")).toBeNull();
    expect(parseIsoDate("soon")).toBeNull();
  });
});

describe("moveItem", () => {
  it("moves an entry one place and stays put at the ends", () => {
    expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });
});
