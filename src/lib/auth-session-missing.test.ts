import { describe, expect, it } from "vitest";
import { isAuthSessionMissingError } from "@/lib/auth-session-missing";

describe("isAuthSessionMissingError", () => {
  it("matches Supabase AuthSessionMissingError", () => {
    const error = Object.assign(new Error("Auth session missing!"), {
      name: "AuthSessionMissingError",
      __isAuthError: true,
      status: 400,
    });

    expect(isAuthSessionMissingError(error)).toBe(true);
  });

  it("does not match other auth failures", () => {
    const error = Object.assign(new Error("Invalid login credentials"), {
      name: "AuthApiError",
      code: "invalid_credentials",
      __isAuthError: true,
      status: 400,
    });

    expect(isAuthSessionMissingError(error)).toBe(false);
  });

  it("does not match a plain Error that only copies the name", () => {
    const error = new Error("Auth session missing!");
    error.name = "AuthSessionMissingError";

    expect(isAuthSessionMissingError(error)).toBe(false);
  });

  it("does not match empty values", () => {
    expect(isAuthSessionMissingError(null)).toBe(false);
    expect(isAuthSessionMissingError(undefined)).toBe(false);
    expect(isAuthSessionMissingError("Auth session missing!")).toBe(false);
  });
});
