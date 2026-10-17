import { z } from "zod";

const nameSchema = z.string().trim().min(1, { message: "Enter a name." }).max(200);

export const itemCreateInputSchema = z.object({
  collectionId: z.string(),
  levelId: z.string(),
  // Omitted for an Item at the top Level; required at every Level below it.
  parentId: z.string().optional(),
  name: nameSchema,
});

export const itemListInputSchema = z.object({
  collectionId: z.string(),
  // Omitted lists the top Level.
  parentId: z.string().optional(),
});

export const itemGetInputSchema = z.object({ id: z.string() });

// An Item as it appears in lists. The rating ticket adds the caller's Overall
// Rating here and to `item.get`.
export const itemSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  levelId: z.string(),
  parentId: z.string().nullable(),
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
});

export type ItemSummary = z.infer<typeof itemSummarySchema>;
export type BreadcrumbEntry = z.infer<typeof breadcrumbEntrySchema>;
export type Item = z.infer<typeof itemSchema>;
