import { afterEach, describe, expect, it, vi } from "vitest";
import { reportError } from "@/lib/report-error";

describe("reportError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("emits event, route, name, message, and stack for a plain Error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("boom");

    reportError(error, { route: "POST /api/sessions" });

    expect(spy).toHaveBeenCalledTimes(1);
    const payload = spy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      event: "server.error",
      route: "POST /api/sessions",
      name: "Error",
      message: "boom",
    });
    expect(typeof payload.stack).toBe("string");
    expect(payload.code).toBeUndefined();
    expect(payload.supabaseCode).toBeUndefined();
    expect(payload.httpStatus).toBeUndefined();
    expect(payload.sessionId).toBeUndefined();
  });

  it("extracts domain code from an Error subclass with code", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    class DomainError extends Error {
      readonly code = "CODE_COLLISION";
      constructor() {
        super("CODE_COLLISION");
        this.name = "SessionServiceError";
      }
    }

    reportError(new DomainError(), { route: "POST /api/sessions", httpStatus: 500 });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "server.error",
        route: "POST /api/sessions",
        name: "SessionServiceError",
        code: "CODE_COLLISION",
        httpStatus: 500,
      }),
    );
    const payload = spy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.supabaseCode).toBeUndefined();
  });

  it("extracts domain code from a plain object with code", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportError({ code: "SESSION_NOT_FOUND", message: "missing" }, { route: "POST /api/play/join" });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "server.error",
        route: "POST /api/play/join",
        code: "SESSION_NOT_FOUND",
        message: "missing",
      }),
    );
  });

  it("maps Auth-shaped code to supabaseCode", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const authError = Object.assign(new Error("Invalid login"), {
      name: "AuthApiError",
      code: "invalid_credentials",
      status: 400,
      __isAuthError: true,
    });

    reportError(authError, { route: "POST /api/auth/signin" });

    const payload = spy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.supabaseCode).toBe("invalid_credentials");
    expect(payload.code).toBeUndefined();
  });

  it("maps PostgREST-shaped code to supabaseCode", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const pgError = Object.assign(new Error("JWT expired"), {
      name: "PostgrestError",
      code: "PGRST301",
      details: "token expired",
      hint: "refresh",
    });

    reportError(pgError, { route: "GET /api/play/board" });

    const payload = spy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.supabaseCode).toBe("PGRST301");
    expect(payload.code).toBeUndefined();
  });

  it("includes optional context scalars when provided", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportError(new Error("x"), {
      route: "POST /api/play/claim",
      httpStatus: 500,
      sessionId: "sess-1",
      sessionCode: "ABCD12",
      position: 4,
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "server.error",
        route: "POST /api/play/claim",
        httpStatus: 500,
        sessionId: "sess-1",
        sessionCode: "ABCD12",
        position: 4,
      }),
    );
  });

  it("omits optional context scalars when absent", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportError(new Error("x"), { route: "/dashboard" });

    const payload = spy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({
        event: "server.error",
        route: "/dashboard",
      }),
    );
    expect("httpStatus" in payload).toBe(false);
    expect("sessionId" in payload).toBe(false);
    expect("sessionCode" in payload).toBe(false);
    expect("position" in payload).toBe(false);
  });

  it("handles non-Error string throwables", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportError("raw failure", { route: "GET /sessions/1" });

    expect(spy).toHaveBeenCalledWith({
      event: "server.error",
      route: "GET /sessions/1",
      message: "raw failure",
    });
  });

  it("handles non-Error number throwables", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportError(42, { route: "GET /play/board" });

    expect(spy).toHaveBeenCalledWith({
      event: "server.error",
      route: "GET /play/board",
      message: "42",
    });
  });

  it("serializes Error.cause when present", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const cause = new Error("root");
    const error = new Error("wrapped", { cause });

    reportError(error, { route: "POST /api/play/claim" });

    const payload = spy.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(payload.cause).toMatchObject({
      name: "Error",
      message: "root",
    });
    expect(typeof (payload.cause as { stack?: string }).stack).toBe("string");
  });

  it("does not throw when given a pathological value", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => {
      reportError(circular, { route: "/x" });
    }).not.toThrow();
    expect(spy).toHaveBeenCalled();
  });
});
