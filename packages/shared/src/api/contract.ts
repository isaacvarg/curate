import { oc } from "@orpc/contract";
import { z } from "zod";

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
};

export type Contract = typeof contract;
