import { createRouterClient } from "@orpc/server";
import type { User } from "@repo/shared";
import { auth } from "@/server/auth";
import type { Context } from "@/server/context";
import { router } from "@/server/router";

// An in-process client for the API, called with a test context instead of
// over HTTP. Pass `user: null` to call as a signed-out caller.
export function createTestClient(context: Context) {
  return createRouterClient(router, { context });
}

let userCount = 0;

// Signs up a real User through Better Auth, so tests see the same rows the
// app would create.
export async function createTestUser(
  overrides: { name?: string; email?: string } = {},
): Promise<User> {
  userCount += 1;
  const { user } = await auth.api.signUpEmail({
    body: {
      name: overrides.name ?? `User ${userCount}`,
      email: overrides.email ?? `user${userCount}@example.com`,
      password: "correct-horse-battery",
    },
  });
  return { id: user.id, name: user.name, email: user.email };
}
