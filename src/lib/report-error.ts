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

/**
 * Emit one structured console.error object for Workers Logs.
 * Never throws.
 */
export function reportError(error: unknown, context: ReportErrorContext): void {
  try {
    const extracted = extractErrorFields(error);
    const payload: Record<string, unknown> = {
      event: "server.error",
      route: context.route,
    };

    if (extracted.name !== undefined) payload.name = extracted.name;
    if (extracted.message !== undefined) payload.message = extracted.message;
    if (extracted.stack !== undefined) payload.stack = extracted.stack;
    if (extracted.code !== undefined) payload.code = extracted.code;
    if (extracted.supabaseCode !== undefined) payload.supabaseCode = extracted.supabaseCode;
    if (extracted.cause !== undefined) payload.cause = extracted.cause;

    if (context.httpStatus !== undefined) payload.httpStatus = context.httpStatus;
    if (context.sessionId !== undefined) payload.sessionId = context.sessionId;
    if (context.sessionCode !== undefined) payload.sessionCode = context.sessionCode;
    if (context.position !== undefined) payload.position = context.position;

    // eslint-disable-next-line no-console -- intentional Workers Logs transport
    console.error(payload);
  } catch {
    try {
      // eslint-disable-next-line no-console -- intentional Workers Logs transport
      console.error({
        event: "server.error",
        route: context.route,
        message: "reportError failed while building payload",
      });
    } catch {
      // swallow — helper must never throw
    }
  }
}
