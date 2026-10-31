import { describe, expect, it } from "vitest";
import { moveItem, orderAfterMove } from "./order";

describe("moveItem", () => {
  it("moves an entry one place and stays put at the ends", () => {
    expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(["a", "b", "c"], 1, 1)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
  });
});

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
