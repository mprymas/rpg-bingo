import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import { DeleteSessionError, deleteSession, deleteSessionErrorFromMessage } from "@/lib/services/sessions.service";

describe("deleteSessionErrorFromMessage", () => {
  it("maps foreign GM / missing session to SESSION_NOT_FOUND", () => {
    const error = deleteSessionErrorFromMessage("session_not_found");
    expect(error).toBeInstanceOf(DeleteSessionError);
    expect(error?.code).toBe("SESSION_NOT_FOUND");
  });

  it("maps prefixed Postgres messages to SESSION_NOT_FOUND", () => {
    const error = deleteSessionErrorFromMessage("ERROR: session_not_found");
    expect(error?.code).toBe("SESSION_NOT_FOUND");
  });

  it("returns null for unknown messages", () => {
    expect(deleteSessionErrorFromMessage("connection refused")).toBeNull();
  });
});

describe("deleteSession", () => {
  it("returns { ok: true } on RPC success", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const supabase = { rpc } as unknown as SupabaseClient<Database>;

    await expect(
      deleteSession(supabase, {
        sessionId: "11111111-1111-1111-1111-111111111111",
      }),
    ).resolves.toEqual({ ok: true });

    expect(rpc).toHaveBeenCalledWith("delete_session", {
      p_session_id: "11111111-1111-1111-1111-111111111111",
    });
  });

  it("rethrows mapped domain errors from RPC messages", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "session_not_found" },
    });
    const supabase = { rpc } as unknown as SupabaseClient<Database>;

    await expect(
      deleteSession(supabase, {
        sessionId: "11111111-1111-1111-1111-111111111111",
      }),
    ).rejects.toMatchObject({ code: "SESSION_NOT_FOUND" });
  });
});
