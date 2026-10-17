type AuthError = { status?: number; code?: string; message?: string };

export const unreachableMessage = "Couldn't reach the server. Check your connection and try again.";

// Turns a Better Auth client error into a message for the sign-in and sign-up
// screens.
export function authErrorMessage(error: AuthError): string {
  if (error.code === "INVALID_EMAIL_OR_PASSWORD" || error.status === 401) {
    return "That email and password don't match. Check them and try again.";
  }
  if (error.code === "USER_ALREADY_EXISTS" || error.code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
    return "An account with that email already exists. Try signing in instead.";
  }
  if (error.code === "PASSWORD_TOO_SHORT") {
    return "Use a password of at least 8 characters.";
  }
  if (error.code === "INVALID_EMAIL") {
    return "Enter a valid email address.";
  }
  if (!error.status) return unreachableMessage;
  return error.message || "Something went wrong. Please try again.";
}
