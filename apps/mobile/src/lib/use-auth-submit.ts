import { useState } from "react";
import { authErrorMessage, unreachableMessage } from "./auth-errors";

type AuthResult = { error: { status?: number; code?: string; message?: string } | null };

// Runs a Better Auth call from a form, tracking progress and a message to show.
// On success the session updates and the root layout routes away.
export function useAuthSubmit(call: () => Promise<AuthResult>) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await call();
      if (result.error) setError(authErrorMessage(result.error));
    } catch {
      setError(unreachableMessage);
    } finally {
      setSubmitting(false);
    }
  }

  return { submit, submitting, error };
}
