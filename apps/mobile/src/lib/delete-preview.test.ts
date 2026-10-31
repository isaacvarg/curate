import { describe, expect, it } from "vitest";
import { describeCollectionDelete, describeFieldDelete, describeItemDelete } from "./delete-preview";

describe("describeCollectionDelete", () => {
  it("lists the Items and Overall Ratings that go with the Collection", () => {
    expect(describeCollectionDelete({ itemCount: 5, overallRatingCount: 4 })).toBe(
      "This also deletes 5 Items and 4 Overall Ratings, including other members' ratings.",
    );
  });

  it("uses the singular for one of each", () => {
    expect(describeCollectionDelete({ itemCount: 1, overallRatingCount: 1 })).toBe(
      "This also deletes 1 Item and 1 Overall Rating, including other members' ratings.",
    );
  });

  it("says so when the Collection is empty", () => {
    expect(describeCollectionDelete({ itemCount: 0, overallRatingCount: 0 })).toBe(
      "This Collection has no Items, so nothing else is deleted.",
    );
  });
});

describe("describeItemDelete", () => {
  it("lists the descendants and Overall Ratings that go with the Item", () => {
    expect(describeItemDelete({ descendantCount: 5, overallRatingCount: 2 })).toBe(
      "This also deletes 5 Items inside it and 2 Overall Ratings, including other members' ratings.",
    );
  });

  it("names only the Item's own ratings when it has no children", () => {
    expect(describeItemDelete({ descendantCount: 0, overallRatingCount: 1 })).toBe(
      "This also deletes 1 Overall Rating of it, including other members' ratings.",
    );
  });

  it("says so when nothing else goes with it", () => {
    expect(describeItemDelete({ descendantCount: 0, overallRatingCount: 0 })).toBe(
      "Nothing else is deleted with it.",
    );
  });
});

describe("describeFieldDelete", () => {
  const none = { dependentConditions: [] };

  it("counts the Items whose value goes with an Attribute", () => {
    expect(describeFieldDelete({ valueCount: 3, ...none }, "attribute")).toBe("This also deletes its value on 3 Items.");
    expect(describeFieldDelete({ valueCount: 1, ...none }, "attribute")).toBe("This also deletes its value on 1 Item.");
  });

  it("says so when no Item has a value for the Attribute", () => {
    expect(describeFieldDelete({ valueCount: 0, ...none }, "attribute")).toBe(
      "No Item has a value for it, so nothing else is deleted.",
    );
  });

  it("counts the Overall Ratings with a value for a Rating field, including other members'", () => {
    expect(describeFieldDelete({ valueCount: 2, ...none }, "rating")).toBe(
      "This also deletes its value in 2 Overall Ratings, including other members' ratings. Overall Ratings left with nothing in them are removed too.",
    );
    expect(describeFieldDelete({ valueCount: 0, ...none }, "rating")).toBe(
      "No Overall Rating has a value for it, so nothing else is deleted.",
    );
  });

  it("counts the Items that use a choice option", () => {
    expect(describeFieldDelete({ valueCount: 4, ...none }, "option")).toBe(
      "This clears the option from 4 Items. Their other choices stay.",
    );
    expect(describeFieldDelete({ valueCount: 0, ...none }, "option")).toBe(
      "No Item uses this option, so nothing else changes.",
    );
  });

  it("lists the conditions that depend on it", () => {
    expect(
      describeFieldDelete(
        {
          valueCount: 3,
          dependentConditions: [
            { id: "c1", description: "Plot: only when Genre is Fiction" },
            { id: "c2", description: "Setting: only when Genre is Fiction" },
          ],
        },
        "attribute",
      ),
    ).toBe(
      "Other fields' conditions use it, so it can't be deleted yet: Plot: only when Genre is Fiction; Setting: only when Genre is Fiction. Change or clear those conditions first.",
    );
  });
});
