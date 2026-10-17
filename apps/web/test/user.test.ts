import { describe, expect, it } from "vitest";
import { createTestClient, createTestUser } from "./harness";

describe("user.me", () => {
  it("returns the signed-in User", async () => {
    const user = await createTestUser({ name: "Ada", email: "ada@example.com" });
    const client = createTestClient({ user });

    await expect(client.user.me()).resolves.toEqual({
      id: user.id,
      name: "Ada",
      email: "ada@example.com",
    });
  });

  it("fails with a typed UNAUTHORIZED error without a User", async () => {
    const client = createTestClient({ user: null });

    await expect(client.user.me()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      defined: true,
    });
  });
});
