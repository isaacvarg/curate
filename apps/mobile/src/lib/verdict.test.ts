import { defaultVerdict } from "@repo/shared";
import { describe, expect, it } from "vitest";
import { formatVerdict, verdictOptions } from "./verdict";

describe("verdictOptions", () => {
  it("offers every star on the default ★1–5 scale as stars", () => {
    expect(verdictOptions(defaultVerdict.scale)).toEqual({ kind: "stars", values: [1, 2, 3, 4, 5] });
  });

  it("offers every step of other numeric scales as choices", () => {
    expect(verdictOptions({ kind: "numeric", min: 0, max: 2, step: 0.5 })).toEqual({
      kind: "choices",
      values: [0, 0.5, 1, 1.5, 2],
    });
  });

  it("offers a label scale's labels worst first", () => {
    expect(verdictOptions({ kind: "labels", labels: ["down", "meh", "up"] })).toEqual({
      kind: "choices",
      values: ["down", "meh", "up"],
    });
  });
});

describe("formatVerdict", () => {
  it("shows stars out of the maximum on a star scale", () => {
    expect(formatVerdict(defaultVerdict.scale, 4)).toBe("★★★★☆");
  });

  it("shows a value out of the maximum on other numeric scales", () => {
    expect(formatVerdict({ kind: "numeric", min: 0, max: 100, step: 1 }, 85)).toBe("85/100");
  });

  it("shows a label as itself", () => {
    expect(formatVerdict({ kind: "labels", labels: ["C", "B", "A", "S"] }, "A")).toBe("A");
  });
});
