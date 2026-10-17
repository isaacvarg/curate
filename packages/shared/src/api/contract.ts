import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  collectionCreateInputSchema,
  collectionDeleteInputSchema,
  collectionDeletePreviewSchema,
  collectionGetInputSchema,
  collectionRenameInputSchema,
  collectionSchema,
  collectionSummarySchema,
  levelSchema,
} from "./collection";
import {
  itemCreateInputSchema,
  itemDeleteInputSchema,
  itemDeletePreviewSchema,
  itemGetInputSchema,
  itemListInputSchema,
  itemRenameInputSchema,
  itemSchema,
  itemSummarySchema,
} from "./item";
import { levelAppendDeepestInputSchema, levelRemoveDeepestInputSchema, levelRenameInputSchema } from "./level";
import { overallRatingSchema, ratingClearOverallInputSchema, ratingSetOverallInputSchema } from "./rating";

// Every non-auth procedure requires a signed-in User and can fail with
// UNAUTHORIZED, so all of them start from this base.
const authed = oc.errors({
  UNAUTHORIZED: { message: "Sign in to continue." },
});

// A Collection the caller isn't a member of reads the same as a missing one,
// so ids reveal nothing.
const collectionNotFound = { NOT_FOUND: { message: "Collection not found." } } as const;

// Breaking FR-1.3 / ADR 0003: a Level or parent from another Collection, a
// parent on a top-Level Item, or a parent that's missing or not at the Level
// directly above.
const invalidStructure = {
  INVALID_STRUCTURE: { message: "An Item's parent must be in its Collection, at the Level directly above." },
} as const;

// An Item in a Collection the caller isn't a member of reads as missing.
const itemNotFound = { NOT_FOUND: { message: "Item not found." } } as const;

// A Verdict value that isn't on the Item's Level's Overall Verdict scale:
// outside its range, off its step, not one of its labels, or the wrong kind.
const valueOutOfScale = {
  VALUE_OUT_OF_SCALE: { message: "That value isn't on this Verdict's scale." },
} as const;

// A delete that would remove more than the one thing named needs the
// caller's explicit confirmation; without it nothing is removed. The data
// carries what would go, so the caller can show it before confirming.
function confirmationRequired<T extends z.ZodType>(data: T) {
  return {
    CONFIRMATION_REQUIRED: { message: "Confirm the delete to remove everything listed.", data },
  } as const;
}

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

export type User = z.infer<typeof userSchema>;

export const contract = {
  user: {
    me: authed.output(userSchema),
  },
  collection: {
    create: authed.input(collectionCreateInputSchema).output(collectionSchema),
    // The caller's Collections, found through their Collection Member rows.
    list: authed.output(z.array(collectionSummarySchema)),
    get: authed.errors(collectionNotFound).input(collectionGetInputSchema).output(collectionSchema),
    rename: authed.errors(collectionNotFound).input(collectionRenameInputSchema).output(collectionSummarySchema),
    deletePreview: authed
      .errors(collectionNotFound)
      .input(collectionGetInputSchema)
      .output(collectionDeletePreviewSchema),
    // Removes the Collection with its Levels, Items, every Collection
    // Member's Overall Ratings and the memberships. Always needs `confirmed`.
    delete: authed
      .errors({ ...collectionNotFound, ...confirmationRequired(collectionDeletePreviewSchema) })
      .input(collectionDeleteInputSchema)
      .output(z.void()),
  },
  level: {
    // A Level in a Collection the caller isn't a member of reads as missing.
    rename: authed
      .errors({ NOT_FOUND: { message: "Level not found." } })
      .input(levelRenameInputSchema)
      .output(levelSchema),
    // Below the current deepest Level, with the default Overall Verdict. Only
    // the deepest Level can be added (or removed), so Levels are never
    // inserted mid-structure and existing positions never change.
    appendDeepest: authed.errors(collectionNotFound).input(levelAppendDeepestInputSchema).output(levelSchema),
    // Only while the deepest Level has no Items, so no Item is ever orphaned.
    removeDeepest: authed
      .errors({
        ...collectionNotFound,
        LEVEL_HAS_ITEMS: {
          message: "This Level still has Items. Delete them before removing the Level.",
          data: z.object({ itemCount: z.number().int() }),
        },
        // FR-1.2: a Collection always keeps at least one Level.
        ONLY_LEVEL: { message: "A Collection needs at least one Level." },
      })
      .input(levelRemoveDeepestInputSchema)
      .output(z.void()),
  },
  item: {
    create: authed
      .errors({ ...collectionNotFound, ...invalidStructure })
      .input(itemCreateInputSchema)
      .output(itemSummarySchema),
    // In sort key order (creation order by default). A parent outside the
    // Collection reads the same as a missing one.
    list: authed
      .errors({ NOT_FOUND: { message: "Collection or parent Item not found." } })
      .input(itemListInputSchema)
      .output(itemSummarySchema.array()),
    // An Item in a Collection the caller isn't a member of reads as missing.
    get: authed
      .errors({ NOT_FOUND: { message: "Item not found." } })
      .input(itemGetInputSchema)
      .output(itemSchema),
    rename: authed.errors(itemNotFound).input(itemRenameInputSchema).output(itemSummarySchema),
    deletePreview: authed.errors(itemNotFound).input(itemGetInputSchema).output(itemDeletePreviewSchema),
    // An Item with no children is deleted straight away. One with children
    // needs `confirmed`, so a whole Show can't be wiped by accident; then its
    // descendants and every Collection Member's Overall Ratings go with it.
    delete: authed
      .errors({ ...itemNotFound, ...confirmationRequired(itemDeletePreviewSchema) })
      .input(itemDeleteInputSchema)
      .output(z.void()),
  },
  rating: {
    // Creates or replaces the caller's Overall Rating of the Item; there's
    // never more than one per (Item, User).
    setOverall: authed
      .errors({ ...itemNotFound, ...valueOutOfScale })
      .input(ratingSetOverallInputSchema)
      .output(overallRatingSchema),
    // Leaves the Item unrated by the caller. Clearing an unrated Item succeeds.
    clearOverall: authed.errors(itemNotFound).input(ratingClearOverallInputSchema).output(z.void()),
  },
};

export type Contract = typeof contract;
