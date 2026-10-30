import { describe, expect, it } from "vitest";
import { attributeConfigSchema, type Field, fieldSchema, validateFieldValue } from "./field";

const genre = {
  type: "singleChoice",
  options: [
    { id: "fic", label: "Fiction" },
    { id: "non", label: "Non-fiction" },
  ],
} as const;

describe("attribute configuration", () => {
  it.each([
    ["text", { type: "text" }],
    ["yes/no", { type: "yesNo" }],
    ["date", { type: "date" }],
    ["a bare number", { type: "number" }],
    ["a number with unit and bounds", { type: "number", unit: "%", min: 0, max: 60 }],
    ["a number whose min equals its max", { type: "number", min: 3, max: 3 }],
    ["single choice", genre],
    ["multiple choice", { ...genre, type: "multipleChoice" }],
  ])("accepts %s", (_, config) => {
    expect(attributeConfigSchema.safeParse(config).success).toBe(true);
  });

  it.each([
    ["min above max", { type: "number", min: 10, max: 1 }],
    ["a non-finite bound", { type: "number", min: Number.NEGATIVE_INFINITY }],
    ["a blank unit", { type: "number", unit: "  " }],
    ["no options", { type: "singleChoice", options: [] }],
    ["a blank option label", { type: "singleChoice", options: [{ id: "a", label: " " }] }],
    ["a blank option id", { type: "singleChoice", options: [{ id: "", label: "A" }] }],
    [
      "duplicate option labels",
      {
        type: "multipleChoice",
        options: [
          { id: "a", label: "Same" },
          { id: "b", label: " Same" },
        ],
      },
    ],
    [
      "duplicate option ids",
      {
        type: "multipleChoice",
        options: [
          { id: "a", label: "One" },
          { id: "a", label: "Two" },
        ],
      },
    ],
    ["an unknown type", { type: "colour" }],
  ])("rejects %s", (_, config) => {
    expect(attributeConfigSchema.safeParse(config).success).toBe(false);
  });

  it("names the problem when min is above max", () => {
    const result = attributeConfigSchema.safeParse({ type: "number", min: 10, max: 1 });
    expect(result.error?.issues[0]?.message).toBe("Minimum must not be above maximum.");
  });
});

describe("field definitions", () => {
  it("accepts an Attribute", () => {
    const field = { id: "f1", kind: "attribute", name: "Genre", position: 0, config: genre };
    expect(fieldSchema.safeParse(field).success).toBe(true);
  });

  it("accepts a Rating field on a bounded scale", () => {
    const field = {
      id: "f2",
      kind: "rating",
      name: "Plot",
      position: 1,
      scale: { kind: "numeric", min: 1, max: 5, step: 1 },
    };
    expect(fieldSchema.safeParse(field).success).toBe(true);
  });

  it("rejects a Rating field with an invalid scale", () => {
    const field = {
      id: "f2",
      kind: "rating",
      name: "Plot",
      position: 1,
      scale: { kind: "numeric", min: 5, max: 1, step: 1 },
    };
    expect(fieldSchema.safeParse(field).success).toBe(false);
  });

  it("rejects a blank name", () => {
    const field = { id: "f1", kind: "attribute", name: "  ", position: 0, config: { type: "text" } };
    expect(fieldSchema.safeParse(field).success).toBe(false);
  });

  it("rejects a negative or fractional position", () => {
    const base = { id: "f1", kind: "attribute", name: "A", config: { type: "text" } };
    expect(fieldSchema.safeParse({ ...base, position: -1 }).success).toBe(false);
    expect(fieldSchema.safeParse({ ...base, position: 1.5 }).success).toBe(false);
  });
});

const attr = (config: unknown, id = "f1") => fieldSchema.parse({ id, kind: "attribute", name: "A", position: 0, config });
const rating = (scale: unknown) => fieldSchema.parse({ id: "r1", kind: "rating", name: "Plot", position: 0, scale });

const messageFor = (field: Field, value: unknown) => {
  const result = validateFieldValue(field, value);
  return result.success ? undefined : result.message;
};

describe("attribute value validation", () => {
  it("accepts text and trims it", () => {
    expect(validateFieldValue(attr({ type: "text" }), "  Brewdog ")).toEqual({ success: true, value: "Brewdog" });
  });

  it("rejects the wrong type with a clear message", () => {
    expect(messageFor(attr({ type: "text" }), 5)).toBe("Enter text.");
    expect(messageFor(attr({ type: "number" }), "5")).toBe("Enter a number.");
    expect(messageFor(attr({ type: "yesNo" }), "yes")).toBe("Choose yes or no.");
  });

  it("rejects blank text", () => {
    expect(messageFor(attr({ type: "text" }), "   ")).toBe("Enter text.");
  });

  it("accepts yes/no both ways", () => {
    expect(validateFieldValue(attr({ type: "yesNo" }), false)).toEqual({ success: true, value: false });
    expect(validateFieldValue(attr({ type: "yesNo" }), true)).toEqual({ success: true, value: true });
  });

  describe("numbers", () => {
    const abv = attr({ type: "number", unit: "%", min: 0, max: 60 });

    it("accepts values inside and on the bounds", () => {
      for (const v of [0, 6.5, 60]) expect(validateFieldValue(abv, v)).toEqual({ success: true, value: v });
    });

    it("rejects values outside the bounds, naming the unit", () => {
      expect(messageFor(abv, 65)).toBe("Must be at most 60 %.");
      expect(messageFor(abv, -1)).toBe("Must be at least 0 %.");
    });

    it("rejects NaN and infinity", () => {
      expect(messageFor(abv, Number.NaN)).toBe("Enter a number.");
      expect(messageFor(abv, Number.POSITIVE_INFINITY)).toBe("Enter a number.");
    });

    it("is unbounded when no bounds are set", () => {
      expect(validateFieldValue(attr({ type: "number" }), -1e9).success).toBe(true);
    });
  });

  describe("dates", () => {
    const date = attr({ type: "date" });

    it("accepts a calendar date", () => {
      expect(validateFieldValue(date, "2024-02-29")).toEqual({ success: true, value: "2024-02-29" });
    });

    it.each(["2023-02-29", "2024-13-01", "24-01-01", "2024-1-1", "yesterday", 20240101])("rejects %s", (v) => {
      expect(messageFor(date, v)).toBe("Enter a valid date (YYYY-MM-DD).");
    });
  });

  describe("single choice", () => {
    const field = attr(genre);

    it("accepts a listed option id", () => {
      expect(validateFieldValue(field, "fic")).toEqual({ success: true, value: "fic" });
    });

    it("rejects an unlisted id and a label", () => {
      expect(messageFor(field, "poetry")).toBe("Pick one of the listed options.");
      expect(messageFor(field, "Fiction")).toBe("Pick one of the listed options.");
    });

    it("rejects an array", () => {
      expect(messageFor(field, ["fic"])).toBe("Pick one of the listed options.");
    });
  });

  describe("multiple choice", () => {
    const field = attr({
      type: "multipleChoice",
      options: [
        { id: "wp", label: "Worker placement" },
        { id: "db", label: "Deck building" },
        { id: "dr", label: "Drafting" },
      ],
    });

    it("accepts a set of listed ids, including none", () => {
      expect(validateFieldValue(field, ["wp", "db"])).toEqual({ success: true, value: ["wp", "db"] });
      expect(validateFieldValue(field, [])).toEqual({ success: true, value: [] });
    });

    it("rejects duplicates", () => {
      expect(messageFor(field, ["wp", "wp"])).toBe("Each option can be picked only once.");
    });

    it("rejects unlisted ids and non-arrays", () => {
      expect(messageFor(field, ["wp", "bluffing"])).toBe("Pick only the listed options.");
      expect(messageFor(field, "wp")).toBe("Pick only the listed options.");
    });
  });

  it("keeps values valid when an option is renamed, since they hold ids", () => {
    const before = attr(genre);
    const after = attr({
      ...genre,
      options: [
        { id: "fic", label: "Made-up stories" },
        { id: "non", label: "Non-fiction" },
      ],
    });
    expect(validateFieldValue(before, "fic").success).toBe(true);
    expect(validateFieldValue(after, "fic").success).toBe(true);
  });
});

describe("Rating field value validation", () => {
  it("accepts a value on the field's numeric scale", () => {
    expect(validateFieldValue(rating({ kind: "numeric", min: 1, max: 5, step: 1 }), 4)).toEqual({
      success: true,
      value: 4,
    });
  });

  it("rejects values off the numeric scale", () => {
    const plot = rating({ kind: "numeric", min: 1, max: 5, step: 1 });
    expect(messageFor(plot, 6)).toBe("Must be at most 5.");
    expect(messageFor(plot, 2.5)).toBe("Must be in steps of 1.");
    expect(messageFor(plot, "4")).toBeDefined();
  });

  it("accepts a label on a label scale and rejects others", () => {
    const hype = rating({ kind: "labels", labels: ["🔥", "🔥🔥", "🔥🔥🔥"] });
    expect(validateFieldValue(hype, "🔥🔥").success).toBe(true);
    expect(messageFor(hype, "🔥🔥🔥🔥")).toBe("Pick one of the scale's labels.");
    expect(messageFor(hype, 2)).toBeDefined();
  });
});
