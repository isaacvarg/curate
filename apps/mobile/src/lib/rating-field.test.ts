import { describe, expect, it } from "vitest";
import { ratingScaleLockedMessage } from "./rating-field";

describe("ratingScaleLockedMessage", () => {
  it("says how many values lock the scale", () => {
    expect(ratingScaleLockedMessage(1)).toMatch(/1 value\b/);
    expect(ratingScaleLockedMessage(3)).toMatch(/3 values\b/);
  });
});
