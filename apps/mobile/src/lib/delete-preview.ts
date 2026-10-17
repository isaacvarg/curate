import type { CollectionDeletePreview, ItemDeletePreview } from "@repo/shared";

function count(n: number, singular: string, plural: string) {
  return `${n} ${n === 1 ? singular : plural}`;
}

// The preview counts include every Collection Member's Overall Ratings, not
// just the caller's.
function ratings(n: number, suffix = "") {
  return `${count(n, "Overall Rating", "Overall Ratings")}${suffix}, including other members' ratings`;
}

// What the user reads before confirming a Collection delete.
export function describeCollectionDelete({ itemCount, overallRatingCount }: CollectionDeletePreview): string {
  if (itemCount === 0) return "This Collection has no Items, so nothing else is deleted.";
  const items = count(itemCount, "Item", "Items");
  if (overallRatingCount === 0) return `This also deletes ${items}.`;
  return `This also deletes ${items} and ${ratings(overallRatingCount)}.`;
}

// What the user reads before confirming an Item delete.
export function describeItemDelete({ descendantCount, overallRatingCount }: ItemDeletePreview): string {
  if (descendantCount === 0) {
    if (overallRatingCount === 0) return "Nothing else is deleted with it.";
    return `This also deletes ${ratings(overallRatingCount, " of it")}.`;
  }
  const items = `${count(descendantCount, "Item", "Items")} inside it`;
  if (overallRatingCount === 0) return `This also deletes ${items}.`;
  return `This also deletes ${items} and ${ratings(overallRatingCount)}.`;
}
