import { z } from "zod";
import { overallRatingSchema } from "./rating";

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

export type ItemDeletePreview = z.infer<typeof itemDeletePreviewSchema>;

// An Item as it appears in lists, with the caller's own Overall Rating (null
// when they haven't rated it). Other Users' ratings are never included.
export const itemSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  levelId: z.string(),
  parentId: z.string().nullable(),
  overallRating: overallRatingSchema.nullable(),
});

export const breadcrumbEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  levelId: z.string(),
});

export const itemSchema = itemSummarySchema.extend({
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
