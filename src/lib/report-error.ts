import * as Sentry from "@sentry/cloudflare";

export interface ReportErrorContext {
  route: string;
  httpStatus?: number;
  sessionId?: string;
  sessionCode?: string;
  position?: number;
}

interface ExtractedErrorFields {
  name?: string;
  message?: string;
  stack?: string;
  code?: string;
  supabaseCode?: string;
  cause?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readStringCode(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return typeof value.code === "string" ? value.code : undefined;
}

/** Auth/PostgREST-shaped errors carry their string `code` as supabaseCode, not domain code. */
function isSupabaseShaped(value: Record<string, unknown>): boolean {
  if ("__isAuthError" in value) return true;
  if (typeof value.details === "string" && typeof value.hint === "string") return true;
  if (typeof value.name === "string") {
    if (value.name === "PostgrestError") return true;
    if (value.name.startsWith("Auth")) return true;
  }
  return false;
}

function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "symbol") return value.description ?? "Symbol";
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function serializeCause(cause: unknown, depth = 0): unknown {
  if (cause === undefined || depth > 5) return undefined;

  if (cause instanceof Error) {
    const serialized: Record<string, unknown> = {
      name: cause.name,
      message: cause.message,
    };
    if (cause.stack) serialized.stack = cause.stack;
    const nested = serializeCause(cause.cause, depth + 1);
    if (nested !== undefined) serialized.cause = nested;
    return serialized;
  }

  if (typeof cause === "string" || typeof cause === "number" || typeof cause === "boolean") {
    return cause;
  }

  if (isRecord(cause)) {
    const out: Record<string, unknown> = {};
    if (typeof cause.name === "string") out.name = cause.name;
    if (typeof cause.message === "string") out.message = cause.message;
    const code = readStringCode(cause);
    if (code !== undefined) {
      if (isSupabaseShaped(cause)) out.supabaseCode = code;
      else out.code = code;
    }
    return Object.keys(out).length > 0 ? out : safeStringify(cause);
  }

  return safeStringify(cause);
}

function extractErrorFields(error: unknown): ExtractedErrorFields {
  const fields: ExtractedErrorFields = {};

  if (error instanceof Error) {
    fields.name = error.name;
    fields.message = error.message;
    if (error.stack) fields.stack = error.stack;
    if (error.cause !== undefined) {
      fields.cause = serializeCause(error.cause);
    }
  } else if (typeof error === "string") {
    fields.message = error;
  } else if (typeof error === "number" || typeof error === "boolean") {
    fields.message = String(error);
  } else if (isRecord(error)) {
    if (typeof error.name === "string") fields.name = error.name;
    if (typeof error.message === "string") fields.message = error.message;
    if (typeof error.stack === "string") fields.stack = error.stack;
    if ("cause" in error && error.cause !== undefined) {
      fields.cause = serializeCause(error.cause);
    }
  } else if (error !== undefined && error !== null) {
    fields.message = safeStringify(error);
  }

  const stringCode = readStringCode(error);
  if (stringCode !== undefined && isRecord(error)) {
    if (isSupabaseShaped(error)) {
      fields.supabaseCode = stringCode;
    } else {
      fields.code = stringCode;
    }
  }

  return fields;
}

/** Turn non-Error throwables into an Error Sentry can group while keeping extracted fields. */
function toCapturable(error: unknown, extracted: ExtractedErrorFields): Error {
  if (error instanceof Error) return error;

  const wrapped = new Error(extracted.message ?? "Non-Error thrown");
  if (extracted.name !== undefined) wrapped.name = extracted.name;
  if (extracted.stack !== undefined) wrapped.stack = extracted.stack;
  return wrapped;
}

/**
 * Report an unexpected soft-catch error to Sentry.
 * Never throws. Safe when DSN is unset (SDK no-ops).
 */
export function reportError(error: unknown, context: ReportErrorContext): void {
  try {
    const extracted = extractErrorFields(error);

    Sentry.withScope((scope) => {
      scope.setTag("route", context.route);

      if (context.httpStatus !== undefined) {
        scope.setTag("httpStatus", String(context.httpStatus));
      }
      if (context.sessionId !== undefined) {
        scope.setTag("sessionId", context.sessionId);
      }
      if (context.sessionCode !== undefined) {
        scope.setTag("sessionCode", context.sessionCode);
      }
      if (context.position !== undefined) {
        scope.setTag("position", String(context.position));
      }
      if (extracted.code !== undefined) {
        scope.setTag("code", extracted.code);
      }
      if (extracted.supabaseCode !== undefined) {
        scope.setTag("supabaseCode", extracted.supabaseCode);
      }
      if (extracted.cause !== undefined) {
        scope.setExtra("cause", extracted.cause);
      }

      Sentry.captureException(toCapturable(error, extracted));
    });
  } catch {
    // swallow — helper must never throw
  }
}
