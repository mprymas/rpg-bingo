import { describe, expect, it } from "vitest";
import { buildPlayerJoinUrl } from "@/lib/player-join-url";

describe("buildPlayerJoinUrl", () => {
  it("builds /play/{CODE}?join=1 from an origin without a trailing slash", () => {
    const url = buildPlayerJoinUrl("https://bingo.example", "ABCDEF");

    expect(url).toBe("https://bingo.example/play/ABCDEF?join=1");
  });

  it("strips a trailing slash from origin", () => {
    expect(buildPlayerJoinUrl("https://bingo.example/", "ABCDEF")).toBe("https://bingo.example/play/ABCDEF?join=1");
  });

  it("uppercases and trims the session code", () => {
    expect(buildPlayerJoinUrl("https://bingo.example", "  abcd23  ")).toBe("https://bingo.example/play/ABCD23?join=1");
  });

  it("includes join=1 exactly once", () => {
    const url = buildPlayerJoinUrl("https://bingo.example/", " wxyz23 ");
    const parsed = new URL(url);

    expect(parsed.searchParams.getAll("join")).toEqual(["1"]);
    expect(parsed.pathname).toBe("/play/WXYZ23");
    expect(parsed.search).toBe("?join=1");
  });
});
