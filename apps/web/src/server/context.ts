import type { User } from "@repo/shared";
import { auth } from "./auth";

export type Context = {
  user: User | null;
};

// Resolves the signed-in User from the Better Auth session (cookie on web,
// the Expo client's cookie header on mobile).
export async function createContext(headers: Headers): Promise<Context> {
  const session = await auth.api.getSession({ headers });
  if (!session) return { user: null };
  const { id, name, email } = session.user;
  return { user: { id, name, email } };
}
