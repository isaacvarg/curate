import { describe, expect, it } from "vitest";
import {
  defaultVerdict,
  toUnitInterval,
  type VerdictScale,
  verdictScaleSchema,
  verdictValueSchema,
} from "./verdict";

describe("verdict scale validation", () => {
  it("accepts a five-star numeric scale", () => {
    expect(verdictScaleSchema.safeParse({ kind: "numeric", min: 1, max: 5, step: 1 }).success).toBe(true);
  });

  it.each([
    ["half stars", { kind: "numeric", min: 0.5, max: 5, step: 0.5 }],
    ["a 0–10 scale in tenths", { kind: "numeric", min: 0, max: 10, step: 0.1 }],
    ["a 100-point scale", { kind: "numeric", min: 0, max: 100, step: 1 }],
    ["tier labels", { kind: "labels", labels: ["F", "D", "C", "B", "A", "S"] }],
    ["two labels", { kind: "labels", labels: ["Thumbs down", "Thumbs up"] }],
  ])("accepts %s", (_, scale) => {
    expect(verdictScaleSchema.safeParse(scale).success).toBe(true);
  });

  it.each([
    ["min equal to max", { kind: "numeric", min: 5, max: 5, step: 1 }],
    ["min above max", { kind: "numeric", min: 10, max: 1, step: 1 }],
    ["a zero step", { kind: "numeric", min: 1, max: 5, step: 0 }],
    ["a negative step", { kind: "numeric", min: 1, max: 5, step: -1 }],
    ["a step that doesn't divide the range", { kind: "numeric", min: 1, max: 5, step: 3 }],
    ["a decimal step that doesn't divide the range", { kind: "numeric", min: 0, max: 1, step: 0.3 }],
    ["no labels", { kind: "labels", labels: [] }],
    ["a single label", { kind: "labels", labels: ["Good"] }],
    ["duplicate labels", { kind: "labels", labels: ["Meh", "Good", "Meh"] }],
    ["an unknown kind", { kind: "stars", count: 5 }],
  ])("rejects %s", (_, scale) => {
    expect(verdictScaleSchema.safeParse(scale).success).toBe(false);
  });
});

const fiveStars: VerdictScale = { kind: "numeric", min: 1, max: 5, step: 1 };
const halfStars: VerdictScale = { kind: "numeric", min: 0.5, max: 5, step: 0.5 };
const tenths: VerdictScale = { kind: "numeric", min: 0, max: 10, step: 0.1 };
const tiers: VerdictScale = { kind: "labels", labels: ["F", "D", "C", "B", "A", "S"] };

describe("verdict value validation", () => {
  it.each([
    ["the minimum of five stars", fiveStars, 1],
    ["the maximum of five stars", fiveStars, 5],
    ["3.5 half stars", halfStars, 3.5],
    ["7.3 on a tenths scale", tenths, 7.3],
    ["a tier in the list", tiers, "B"],
  ])("accepts %s", (_, scale, value) => {
    expect(verdictValueSchema(scale).safeParse(value).success).toBe(true);
  });

  it.each([
    ["a value below the minimum", fiveStars, 0],
    ["a value above the maximum", fiveStars, 6],
    ["an off-step value", halfStars, 3.25],
    ["a label on a numeric scale", fiveStars, "A"],
    ["a label not in the list", tiers, "Z"],
    ["a number on a label scale", tiers, 2],
  ])("rejects %s", (_, scale, value) => {
    expect(verdictValueSchema(scale).safeParse(value).success).toBe(false);
  });
});

describe("verdict conversion to 0–1", () => {
  it.each([
    ["the minimum of five stars", fiveStars, 1, 0],
    ["the middle of five stars", fiveStars, 3, 0.5],
    ["the maximum of five stars", fiveStars, 5, 1],
    ["the minimum of half stars", halfStars, 0.5, 0],
    ["3 of half stars", halfStars, 3, 5 / 9],
    ["the maximum of half stars", halfStars, 5, 1],
    ["the first tier", tiers, "F", 0],
    ["the third tier", tiers, "C", 0.4],
    ["the last tier", tiers, "S", 1],
  ])("converts %s", (_, scale, value, expected) => {
    expect(toUnitInterval(scale, value)).toBeCloseTo(expected, 12);
  });

  it("throws for a value that isn't on the scale", () => {
    expect(() => toUnitInterval(tiers, "Z")).toThrow();
    expect(() => toUnitInterval(fiveStars, 7)).toThrow();
  });
});

describe("default verdict", () => {
  it("is Overall on a five-star scale", () => {
    expect(defaultVerdict).toEqual({ name: "Overall", scale: { kind: "numeric", min: 1, max: 5, step: 1 } });
    expect(verdictScaleSchema.safeParse(defaultVerdict.scale).success).toBe(true);
  });
});
