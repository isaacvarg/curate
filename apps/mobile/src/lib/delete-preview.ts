import type { CollectionDeletePreview, FieldDeletePreview, ItemDeletePreview } from "@repo/shared";

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

// What the user reads before confirming the delete of an Attribute, a Rating
// field, or one choice option. While other fields' conditions use it, it can't
// be deleted: they are named instead of the counts.
export function describeFieldDelete(
  { valueCount, dependentConditions }: FieldDeletePreview,
  what: "attribute" | "rating" | "option",
): string {
  if (dependentConditions.length > 0) {
    return `Other fields' conditions use it, so it can't be deleted yet: ${dependentConditions.map((c) => c.description).join("; ")}. Change or clear those conditions first.`;
  }
  let text: string;
  if (what === "attribute") {
    text =
      valueCount === 0
        ? "No Item has a value for it, so nothing else is deleted."
        : `This also deletes its value on ${count(valueCount, "Item", "Items")}.`;
  } else if (what === "rating") {
    text =
      valueCount === 0
        ? "No Overall Rating has a value for it, so nothing else is deleted."
        : `This also deletes its value in ${count(valueCount, "Overall Rating", "Overall Ratings")}, including other members' ratings. Overall Ratings left with nothing in them are removed too.`;
  } else {
    text =
      valueCount === 0
        ? "No Item uses this option, so nothing else changes."
        : `This clears the option from ${count(valueCount, "Item", "Items")}. Their other choices stay.`;
  }
  return text;
}
