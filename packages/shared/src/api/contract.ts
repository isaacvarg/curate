import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  collectionCreateInputSchema,
  collectionGetInputSchema,
  collectionSchema,
  collectionSummarySchema,
} from "./collection";
import { itemCreateInputSchema, itemGetInputSchema, itemListInputSchema, itemSchema, itemSummarySchema } from "./item";

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
};

export type Contract = typeof contract;
