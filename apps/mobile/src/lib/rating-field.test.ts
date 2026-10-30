import { describe, expect, it } from "vitest";
import { orderAfterMove, ratingScaleLockedMessage } from "./rating-field";

const fields = [
  { id: "a", kind: "attribute" },
  { id: "p", kind: "rating" },
  { id: "b", kind: "attribute" },
  { id: "q", kind: "rating" },
  { id: "r", kind: "rating" },
] as const;

describe("orderAfterMove", () => {
  it("moves a Rating field among the Rating fields and leaves Attributes in their slots", () => {
    expect(orderAfterMove(fields, "rating", 2, -1)).toEqual(["a", "p", "b", "r", "q"]);
    expect(orderAfterMove(fields, "rating", 0, 1)).toEqual(["a", "q", "b", "p", "r"]);
  });

  it("moves an Attribute among the Attributes", () => {
    expect(orderAfterMove(fields, "attribute", 0, 1)).toEqual(["b", "p", "a", "q", "r"]);
  });

  it("lists every Field exactly once, and stays put at either end", () => {
    expect(orderAfterMove(fields, "rating", 0, -1)).toEqual(["a", "p", "b", "q", "r"]);
    expect(orderAfterMove(fields, "rating", 2, 1)).toEqual(["a", "p", "b", "q", "r"]);
  });
});

describe("ratingScaleLockedMessage", () => {
  it("says how many values lock the scale", () => {
    expect(ratingScaleLockedMessage(1)).toMatch(/1 value\b/);
    expect(ratingScaleLockedMessage(3)).toMatch(/3 values\b/);
  });
});
