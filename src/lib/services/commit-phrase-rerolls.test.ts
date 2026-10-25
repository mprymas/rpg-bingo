import { describe, expect, it } from "vitest";
import { commitPhraseRerollsErrorFromMessage, PhraseRerollError } from "@/lib/services/sessions.service";

describe("commitPhraseRerollsErrorFromMessage", () => {
  it("maps cell_claimed:7,12 to positions [7, 12]", () => {
    const error = commitPhraseRerollsErrorFromMessage("cell_claimed:7,12");
    expect(error).toBeInstanceOf(PhraseRerollError);
    expect(error?.code).toBe("CELL_CLAIMED");
    expect(error?.positions).toEqual([7, 12]);
  });

  it("maps a prefixed Postgres message and a single position", () => {
    expect(commitPhraseRerollsErrorFromMessage("ERROR: cell_claimed:7,12")?.positions).toEqual([7, 12]);
    expect(commitPhraseRerollsErrorFromMessage("cell_claimed:7")?.positions).toEqual([7]);
  });

  it("maps the other RPC names without a live database", () => {
    expect(commitPhraseRerollsErrorFromMessage("session_not_found")?.code).toBe("SESSION_NOT_FOUND");
    expect(commitPhraseRerollsErrorFromMessage("ERROR: invalid_position")?.code).toBe("INVALID_POSITION");
    expect(commitPhraseRerollsErrorFromMessage("cell_not_found")?.code).toBe("CELL_NOT_FOUND");
    expect(commitPhraseRerollsErrorFromMessage("phrase_not_in_catalog")?.code).toBe("PHRASE_NOT_IN_CATALOG");
    expect(commitPhraseRerollsErrorFromMessage("duplicate_phrase")?.code).toBe("DUPLICATE_PHRASE");
  });

  it("returns null for unknown messages", () => {
    expect(commitPhraseRerollsErrorFromMessage("connection refused")).toBeNull();
  });
});
