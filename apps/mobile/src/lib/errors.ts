import { ORPCError } from "@orpc/client";

// What to tell the user when a call fails. `fallback` names what failed
// ("Couldn't delete it."). `badRequest` explains rejected input; give it only
// for calls that take user-typed input (a name), so a call that takes none
// never blames it.
export function errorMessage(error: unknown, { fallback, badRequest }: { fallback: string; badRequest?: string }) {
  if (!(error instanceof ORPCError)) return "Couldn't reach the server. Try again.";
  // Typed errors (NOT_FOUND, CONFIRMATION_REQUIRED, UNAUTHORIZED...) carry a message meant for people.
  if (error.defined) return error.message;
  // Input validation failures come back as BAD_REQUEST.
  if (error.code === "BAD_REQUEST" && badRequest !== undefined) return badRequest;
  return `${fallback} Try again.`;
}
