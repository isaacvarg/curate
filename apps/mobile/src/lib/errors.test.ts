import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";
import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("shows a typed error's own message", () => {
    const error = new ORPCError("NOT_FOUND", { message: "Item not found.", defined: true });

    expect(errorMessage(error, { fallback: "Couldn't delete it." })).toBe("Item not found.");
  });

  it("explains a rejected name when the call takes one", () => {
    const error = new ORPCError("BAD_REQUEST");

    expect(errorMessage(error, { fallback: "Couldn't rename it.", badRequest: "Give it a name." })).toBe(
      "Give it a name.",
    );
  });

  it("doesn't blame a name for a rejected call that takes none", () => {
    const error = new ORPCError("BAD_REQUEST");

    expect(errorMessage(error, { fallback: "Couldn't delete it." })).toBe("Couldn't delete it. Try again.");
  });

  it("falls back for other server errors", () => {
    expect(errorMessage(new ORPCError("INTERNAL_SERVER_ERROR"), { fallback: "Couldn't add it." })).toBe(
      "Couldn't add it. Try again.",
    );
  });

  it("blames the connection for anything that isn't a server error", () => {
    expect(errorMessage(new TypeError("Network request failed"), { fallback: "Couldn't add it." })).toBe(
      "Couldn't reach the server. Try again.",
    );
  });
});
