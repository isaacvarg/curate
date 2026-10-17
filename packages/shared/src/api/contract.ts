import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  collectionCreateInputSchema,
  collectionGetInputSchema,
  collectionSchema,
  collectionSummarySchema,
  levelSchema,
} from "./collection";
import { itemCreateInputSchema, itemGetInputSchema, itemListInputSchema, itemSchema, itemSummarySchema } from "./item";
import {
  levelAppendDeepestInputSchema,
  levelRemoveDeepestInputSchema,
  levelRenameInputSchema,
  levelUpdateVerdictInputSchema,
} from "./level";
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
    // Renaming is always allowed. A scale change (including a change of kind)
    // is refused while anyone has an Overall Rating at the Level, so stored
    // raw values are never reinterpreted on a different scale.
    updateVerdict: authed
      .errors({
        NOT_FOUND: { message: "Level not found." },
        SCALE_LOCKED: {
          message: "This scale is locked because Items at this Level already have ratings.",
          data: z.object({ ratingCount: z.number().int() }),
        },
      })
      .input(levelUpdateVerdictInputSchema)
      .output(levelSchema),
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
