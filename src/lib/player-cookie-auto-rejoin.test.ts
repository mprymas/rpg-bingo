import { describe, expect, it } from "vitest";
import { nickForAutoRejoin, writePlayerIdentity } from "@/lib/player-cookie";

const CODE = "ABCD23";
const OTHER = "XYZ789";

function cookieWithIdentity(code: string, nick: string, lastNick?: string): string {
  const written = writePlayerIdentity(null, code, {
    playerId: "11111111-1111-4111-8111-111111111111",
    claimToken: "22222222-2222-4222-8222-222222222222",
    nick,
    color: 3,
  });
  if (!lastNick) return written.value;
  const parsed = JSON.parse(written.value) as { lastNick?: string; byCode: Record<string, unknown> };
  parsed.lastNick = lastNick;
  return JSON.stringify(parsed);
}

describe("nickForAutoRejoin", () => {
  it("prefers identity nick for the old code over lastNick", () => {
    const cookie = cookieWithIdentity(CODE, "Anna", "Borin");
    expect(nickForAutoRejoin(cookie, CODE)).toBe("Anna");
  });

  it("falls back to lastNick when no identity for the code", () => {
    const cookie = cookieWithIdentity(OTHER, "Cyra", "Cyra");
    expect(nickForAutoRejoin(cookie, CODE)).toBe("Cyra");
  });

  it("returns null when cookie has neither identity nor lastNick", () => {
    expect(nickForAutoRejoin(null, CODE)).toBeNull();
    expect(nickForAutoRejoin("{}", CODE)).toBeNull();
  });
});
