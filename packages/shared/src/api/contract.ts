import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  collectionCreateInputSchema,
  collectionGetInputSchema,
  collectionSchema,
  collectionSummarySchema,
} from "./collection";

// Every non-auth procedure requires a signed-in User and can fail with
// UNAUTHORIZED, so all of them start from this base.
const authed = oc.errors({
  UNAUTHORIZED: { message: "Sign in to continue." },
});

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
    // A Collection the caller isn't a member of reads the same as a missing
    // one, so ids reveal nothing.
    get: authed
      .errors({ NOT_FOUND: { message: "Collection not found." } })
      .input(collectionGetInputSchema)
      .output(collectionSchema),
  },
};

export type Contract = typeof contract;
