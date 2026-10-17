import { contract } from "@repo/shared";
import { implement } from "@orpc/server";
import type { Context } from "./context";

// Assembles the router. Procedures come from `authed` below, never from here.
export const os = implement(contract).$context<Context>();

// Every non-auth procedure is implemented from here: it narrows the context to
// a signed-in User, or fails with UNAUTHORIZED.
export const authed = os.use(async ({ context, next, errors }) => {
  if (!context.user) throw errors.UNAUTHORIZED();
  return next({ context: { user: context.user } });
});
