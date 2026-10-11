import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import {
  CloseSessionAsReplacedError,
  closeSessionAsReplaced,
  closeSessionAsReplacedErrorFromMessage,
} from "@/lib/services/sessions.service";

describe("closeSessionAsReplacedErrorFromMessage", () => {
  it("maps foreign GM / missing source to SESSION_NOT_FOUND", () => {
    const error = closeSessionAsReplacedErrorFromMessage("session_not_found");
    expect(error).toBeInstanceOf(CloseSessionAsReplacedError);
    expect(error?.code).toBe("SESSION_NOT_FOUND");
  });

  it("maps already closed source to SESSION_NOT_ACTIVE", () => {
    const error = closeSessionAsReplacedErrorFromMessage("ERROR: session_not_active");
    expect(error?.code).toBe("SESSION_NOT_ACTIVE");
  });

  it("maps missing / foreign replacement to REPLACEMENT_NOT_FOUND", () => {
    const error = closeSessionAsReplacedErrorFromMessage("replacement_not_found");
    expect(error?.code).toBe("REPLACEMENT_NOT_FOUND");
  });

  it("returns null for unknown messages", () => {
    expect(closeSessionAsReplacedErrorFromMessage("connection refused")).toBeNull();
  });
});

describe("closeSessionAsReplaced", () => {
  it("returns { ok: true } on RPC success", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = { rpc } as unknown as SupabaseClient<Database>;

    await expect(
      closeSessionAsReplaced(supabase, {
        sessionId: "11111111-1111-1111-1111-111111111111",
        replacedBySessionId: "22222222-2222-2222-2222-222222222222",
      }),
    ).resolves.toEqual({ ok: true });

    expect(rpc).toHaveBeenCalledWith("close_session_as_replaced", {
      p_session_id: "11111111-1111-1111-1111-111111111111",
      p_replaced_by: "22222222-2222-2222-2222-222222222222",
    });
  });

  it("rethrows mapped domain errors from RPC messages", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "session_not_found" },
    });
    const supabase = { rpc } as unknown as SupabaseClient<Database>;

    await expect(
      closeSessionAsReplaced(supabase, {
        sessionId: "11111111-1111-1111-1111-111111111111",
        replacedBySessionId: "22222222-2222-2222-2222-222222222222",
      }),
    ).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });
  });
});
