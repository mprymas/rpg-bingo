function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Supabase `getUser()` returns this when the request has no auth session.
 * Signed-out visitors hit that path on every request; it is not a failure.
 */
export function isAuthSessionMissingError(error: unknown): boolean {
  return isRecord(error) && error.__isAuthError === true && error.name === "AuthSessionMissingError";
}
