import { defaultVerdict } from "@repo/shared";
import { describe, expect, it } from "vitest";
import { describeScale, parseScaleDraft, scaleLockedMessage, scalePresets, toScaleDraft } from "./verdict-settings";

describe("parseScaleDraft", () => {
  it("reads a numeric scale from its fields", () => {
    expect(parseScaleDraft({ kind: "numeric", min: "0", max: " 100", step: "1 " })).toEqual({
      scale: { kind: "numeric", min: 0, max: 100, step: 1 },
    });
  });

  it("reads half stars", () => {
    expect(parseScaleDraft({ kind: "numeric", min: "0.5", max: "5", step: "0.5" })).toEqual({
      scale: { kind: "numeric", min: 0.5, max: 5, step: 0.5 },
    });
  });

  it("asks for numbers when a field isn't one", () => {
    expect(parseScaleDraft({ kind: "numeric", min: "", max: "10", step: "1" })).toEqual({
      error: "Minimum, maximum and step must be numbers.",
    });
    expect(parseScaleDraft({ kind: "numeric", min: "0", max: "ten", step: "1" })).toEqual({
      error: "Minimum, maximum and step must be numbers.",
    });
  });

  it.each([
    [{ min: "10", max: "1", step: "1" }, "Minimum must be below maximum."],
    [{ min: "0", max: "10", step: "3" }, "Step must divide the range evenly."],
    [{ min: "0", max: "10", step: "0" }, "Step must be above zero."],
  ])("explains why %o isn't a valid scale", (fields, error) => {
    expect(parseScaleDraft({ kind: "numeric", ...fields })).toEqual({ error });
  });

  it("reads labels one per line, worst first, ignoring blank lines and spaces", () => {
    expect(parseScaleDraft({ kind: "labels", labels: "Thumbs down\n  Meh \n\nThumbs up\n" })).toEqual({
      scale: { kind: "labels", labels: ["Thumbs down", "Meh", "Thumbs up"] },
    });
  });

  it.each([
    ["Only one", "A label scale needs at least two labels."],
    ["Meh\nMeh", "Labels must be distinct."],
  ])("explains why labels %j aren't a valid scale", (labels, error) => {
    expect(parseScaleDraft({ kind: "labels", labels })).toEqual({ error });
  });
});

describe("toScaleDraft", () => {
  it("fills the numeric fields from a scale", () => {
    expect(toScaleDraft(defaultVerdict.scale)).toEqual({ kind: "numeric", min: "1", max: "5", step: "1" });
  });

  it("puts each label on its own line", () => {
    expect(toScaleDraft({ kind: "labels", labels: ["C", "B", "A"] })).toEqual({ kind: "labels", labels: "C\nB\nA" });
  });
});

describe("scalePresets", () => {
  it("are all valid scales", () => {
    for (const preset of scalePresets) {
      expect(parseScaleDraft(toScaleDraft(preset.scale))).toEqual({ scale: preset.scale });
    }
  });

  it("include stars, half stars, 1–10, 0–100, tiers and thumbs", () => {
    expect(scalePresets.map((preset) => preset.title)).toEqual([
      "★1–5",
      "Half stars",
      "1–10",
      "0–100",
      "Tiers F–S",
      "Thumbs",
    ]);
  });
});

describe("describeScale", () => {
  it("names a numeric scale by its range", () => {
    expect(describeScale({ kind: "numeric", min: 0, max: 100, step: 1 })).toBe("0–100");
  });

  it("mentions a step other than 1", () => {
    expect(describeScale({ kind: "numeric", min: 0.5, max: 5, step: 0.5 })).toBe("0.5–5 in steps of 0.5");
  });

  it("lists labels worst first", () => {
    expect(describeScale({ kind: "labels", labels: ["Down", "Meh", "Up"] })).toBe("Down < Meh < Up");
  });
});

describe("scaleLockedMessage", () => {
  it("explains the lock and how to lift it", () => {
    expect(scaleLockedMessage(1)).toBe(
      "This Level already has 1 rating, so its scale is locked: changing it would change what that rating means. Clear it to unlock the scale. You can still rename the Verdict.",
    );
    expect(scaleLockedMessage(3)).toBe(
      "This Level already has 3 ratings, so its scale is locked: changing it would change what those ratings mean. Clear them to unlock the scale. You can still rename the Verdict.",
    );
  });
});
