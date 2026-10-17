import { describe, expect, it } from "vitest";
import { describeCollectionDelete, describeItemDelete } from "./delete-preview";

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
