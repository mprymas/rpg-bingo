import { afterEach, describe, expect, it, vi } from "vitest";
import { reportError } from "@/lib/report-error";

const sentryMocks = vi.hoisted(() => {
  const setTag = vi.fn();
  const setExtra = vi.fn();
  const captureException = vi.fn();
  const withScope = vi.fn((callback: (scope: { setTag: typeof setTag; setExtra: typeof setExtra }) => void) => {
    callback({ setTag, setExtra });
  });
  return { setTag, setExtra, captureException, withScope };
});

vi.mock("@sentry/cloudflare", () => ({
  withScope: sentryMocks.withScope,
  captureException: sentryMocks.captureException,
}));

function tagMap(): Record<string, string> {
  const entries: [string, string][] = sentryMocks.setTag.mock.calls.map((call) => {
    const [key, value] = call as [string, string];
    return [key, value];
  });
  return Object.fromEntries(entries);
}

describe("reportError", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("captures route, name, message, and stack for a plain Error", () => {
    const error = new Error("boom");

    reportError(error, { route: "POST /api/sessions" });

    expect(sentryMocks.withScope).toHaveBeenCalledTimes(1);
    expect(sentryMocks.captureException).toHaveBeenCalledTimes(1);
    expect(sentryMocks.captureException).toHaveBeenCalledWith(error);
    expect(tagMap()).toEqual({ route: "POST /api/sessions" });
    expect(sentryMocks.setExtra).not.toHaveBeenCalled();
  });

  it("extracts domain code from an Error subclass with code", () => {
    class DomainError extends Error {
      readonly code = "CODE_COLLISION";
      constructor() {
        super("CODE_COLLISION");
        this.name = "SessionServiceError";
      }
    }

    const error = new DomainError();
    reportError(error, { route: "POST /api/sessions", httpStatus: 500 });

    expect(sentryMocks.captureException).toHaveBeenCalledWith(error);
    expect(tagMap()).toMatchObject({
      route: "POST /api/sessions",
      code: "CODE_COLLISION",
      httpStatus: "500",
    });
    expect(tagMap().supabaseCode).toBeUndefined();
  });

  it("extracts domain code from a plain object with code", () => {
    reportError({ code: "SESSION_NOT_FOUND", message: "missing" }, { route: "POST /api/play/join" });

    expect(sentryMocks.captureException).toHaveBeenCalledTimes(1);
    const captured = sentryMocks.captureException.mock.calls[0]?.[0] as Error;
    expect(captured).toBeInstanceOf(Error);
    expect(captured.message).toBe("missing");
    expect(tagMap()).toMatchObject({
      route: "POST /api/play/join",
      code: "SESSION_NOT_FOUND",
    });
  });

  it("maps Auth-shaped code to supabaseCode", () => {
    const authError = Object.assign(new Error("Invalid login"), {
      name: "AuthApiError",
      code: "invalid_credentials",
      status: 400,
      __isAuthError: true,
    });

    reportError(authError, { route: "POST /api/auth/signin" });

    expect(sentryMocks.captureException).toHaveBeenCalledWith(authError);
    expect(tagMap().supabaseCode).toBe("invalid_credentials");
    expect(tagMap().code).toBeUndefined();
  });

  it("maps PostgREST-shaped code to supabaseCode", () => {
    const pgError = Object.assign(new Error("JWT expired"), {
      name: "PostgrestError",
      code: "PGRST301",
      details: "token expired",
      hint: "refresh",
    });

    reportError(pgError, { route: "GET /api/play/board" });

    expect(sentryMocks.captureException).toHaveBeenCalledWith(pgError);
    expect(tagMap().supabaseCode).toBe("PGRST301");
    expect(tagMap().code).toBeUndefined();
  });

  it("includes optional context scalars when provided", () => {
    reportError(new Error("x"), {
      route: "POST /api/play/claim",
      httpStatus: 500,
      sessionId: "sess-1",
      sessionCode: "ABCD12",
      position: 4,
    });

    expect(tagMap()).toEqual({
      route: "POST /api/play/claim",
      httpStatus: "500",
      sessionId: "sess-1",
      sessionCode: "ABCD12",
      position: "4",
    });
  });

  it("omits optional context scalars when absent", () => {
    reportError(new Error("x"), { route: "/dashboard" });

    expect(tagMap()).toEqual({ route: "/dashboard" });
    expect(Object.keys(tagMap())).not.toContain("httpStatus");
    expect(Object.keys(tagMap())).not.toContain("sessionId");
    expect(Object.keys(tagMap())).not.toContain("sessionCode");
    expect(Object.keys(tagMap())).not.toContain("position");
  });

  it("handles non-Error string throwables", () => {
    reportError("raw failure", { route: "GET /sessions/1" });

    const captured = sentryMocks.captureException.mock.calls[0]?.[0] as Error;
    expect(captured).toBeInstanceOf(Error);
    expect(captured.message).toBe("raw failure");
    expect(tagMap()).toEqual({ route: "GET /sessions/1" });
  });

  it("handles non-Error number throwables", () => {
    reportError(42, { route: "GET /play/board" });

    const captured = sentryMocks.captureException.mock.calls[0]?.[0] as Error;
    expect(captured).toBeInstanceOf(Error);
    expect(captured.message).toBe("42");
    expect(tagMap()).toEqual({ route: "GET /play/board" });
  });

  it("serializes Error.cause when present", () => {
    const cause = new Error("root");
    const error = new Error("wrapped", { cause });

    reportError(error, { route: "POST /api/play/claim" });

    expect(sentryMocks.captureException).toHaveBeenCalledWith(error);
    expect(sentryMocks.setExtra).toHaveBeenCalledWith(
      "cause",
      expect.objectContaining({
        name: "Error",
        message: "root",
      }),
    );
    const causeExtra = sentryMocks.setExtra.mock.calls[0]?.[1] as { stack?: string };
    expect(typeof causeExtra.stack).toBe("string");
  });

  it("does not throw when given a pathological value", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => {
      reportError(circular, { route: "/x" });
    }).not.toThrow();
    expect(sentryMocks.captureException).toHaveBeenCalled();
  });

  it("does not throw when Sentry capture fails", () => {
    sentryMocks.captureException.mockImplementation(() => {
      throw new Error("sentry unavailable");
    });

    expect(() => {
      reportError(new Error("x"), { route: "/x" });
    }).not.toThrow();
  });
});
