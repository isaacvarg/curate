import { describe, expect, it } from "vitest";
import { plural } from "./plural";

describe("plural", () => {
  it("picks the singular only at exactly one", () => {
    expect(plural(1)("Item has", "Items have")).toBe("Item has");
    expect(plural(0)("Item has", "Items have")).toBe("Items have");
    expect(plural(2)("Item has", "Items have")).toBe("Items have");
  });
});
