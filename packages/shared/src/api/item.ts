import { z } from "zod";
import { overallRatingSchema, overallVerdictSchema } from "./rating";

// The shape of any Attribute value; whether it fits its Field is checked with
// the Field's own rules once the Field is known.
export const attributeValueInputSchema = z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]);

// An Item's Attribute values by Field id. A Field with no value is absent.
export const attributeValuesSchema = z.record(z.string(), attributeValueInputSchema);

export type AttributeValues = z.infer<typeof attributeValuesSchema>;

// Sets the listed Attributes of one Item at once: a value sets it, `null`
// clears it, and Fields left out are untouched.
export const itemSetAttributesInputSchema = z.object({
  itemId: z.string(),
  values: z.record(z.string(), attributeValueInputSchema.nullable()),
});

// Longer than `shortNameSchema`: Item names include titles like episode names.
const itemNameSchema = z.string().trim().min(1, { message: "Enter a name." }).max(200);

export const itemCreateInputSchema = z.object({
  collectionId: z.string(),
  levelId: z.string(),
  // Omitted for an Item at the top Level; required at every Level below it.
  parentId: z.string().optional(),
  name: itemNameSchema,
});

export const itemListInputSchema = z.object({
  collectionId: z.string(),
  // Omitted lists the top Level.
  parentId: z.string().optional(),
});

export const itemSearchSortSchema = z.object({
  // Name, the caller's own Verdict, or a number or date Attribute (`fieldId`).
  by: z.enum(["name", "verdict", "attribute"]),
  fieldId: z.string().optional(),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

export const SEARCH_PAGE_SIZE_MAX = 100;

// Items at one Level across the whole Collection, under every parent. The
// filter is an Expression in the filter profile, checked on the server; it
// reads the caller's own Rating field values and Verdict only.
export const itemSearchInputSchema = z.object({
  collectionId: z.string(),
  levelId: z.string(),
  filter: z.unknown().optional(),
  sort: itemSearchSortSchema.optional(),
  limit: z.number().int().min(1).max(SEARCH_PAGE_SIZE_MAX).default(50),
  offset: z.number().int().min(0).default(0),
});

export const itemGetInputSchema = z.object({ id: z.string() });

export const itemRenameInputSchema = z.object({ id: z.string(), name: itemNameSchema });

// What deleting an Item would remove along with it: its descendants at every
// Level below, and every Collection Member's Overall Ratings of the Item and
// those descendants.
export const itemDeletePreviewSchema = z.object({
  descendantCount: z.number().int(),
  overallRatingCount: z.number().int(),
});

export const itemDeleteInputSchema = z.object({
  id: z.string(),
  // Needed only when the Item has children: set once the caller has seen the
  // delete preview and confirmed the cascade.
  confirmed: z.boolean().optional(),
});

export type ItemSearchSort = z.infer<typeof itemSearchSortSchema>;

export type ItemDeletePreview = z.infer<typeof itemDeletePreviewSchema>;

// An Item as it appears in lists, with the caller's own Verdict (null when
// they haven't rated it; a null `verdict` inside means only Rating fields are
// set). Other Users' ratings are never included.
export const itemSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  levelId: z.string(),
  parentId: z.string().nullable(),
  overallRating: overallVerdictSchema.nullable(),
});

export const breadcrumbEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  levelId: z.string(),
});

export const itemSchema = itemSummarySchema.extend({
  // The caller's whole Overall Rating, with its Rating field values.
  overallRating: overallRatingSchema.nullable(),
  collectionId: z.string(),
  // The Item's ancestors, top Level first; the Item itself isn't included.
  breadcrumb: z.array(breadcrumbEntrySchema),
  childCount: z.number().int(),
  // The Item's own Attribute values, the same for every Collection Member.
  attributes: attributeValuesSchema,
});

export type ItemSummary = z.infer<typeof itemSummarySchema>;
export type BreadcrumbEntry = z.infer<typeof breadcrumbEntrySchema>;
export type Item = z.infer<typeof itemSchema>;

// One page of matches, with how many Items matched in all.
export const itemSearchResultSchema = z.object({
  items: itemSummarySchema.array(),
  total: z.number().int(),
});

export type ItemSearchResult = z.infer<typeof itemSearchResultSchema>;
