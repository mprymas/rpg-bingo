export const PLAYER_COOKIE_NAME = "rpg_player";
export const PLAYER_COOKIE_MAX_AGE = 34560000;

const PLAYER_COOKIE_MAX_LENGTH = 3500;
const PLAYER_NICK_MIN_LENGTH = 1;
const PLAYER_NICK_MAX_LENGTH = 24;
export interface PlayerIdentity {
  nick: string;
  color: number;
  seen: number;
}

export interface PlayerCookieWrite {
  value: string;
  httpOnly: true;
  sameSite: "lax";
  path: "/";
  maxAge: number;
}

interface PlayerCookieState {
  lastNick: string | null;
  byCode: Record<string, PlayerIdentity>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlayerColor(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 16;
}

function hasControlChar(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f) return true;
  }
  return false;
}

export function canonicalPlayerNick(value: string): string | null {
  const nick = value.trim();
  if (nick.length < PLAYER_NICK_MIN_LENGTH || nick.length > PLAYER_NICK_MAX_LENGTH) return null;
  if (hasControlChar(nick)) return null;
  return nick;
}

function readSeen(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function emptyState(): PlayerCookieState {
  return { lastNick: null, byCode: {} };
}

function parsePlayerCookie(cookie: string | null | undefined): PlayerCookieState {
  if (!cookie) return emptyState();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cookie);
  } catch {
    return emptyState();
  }
  if (!isRecord(parsed)) return emptyState();

  const lastNick = typeof parsed.lastNick === "string" ? canonicalPlayerNick(parsed.lastNick) : null;
  const byCode: Record<string, PlayerIdentity> = {};

  if (isRecord(parsed.byCode)) {
    for (const [code, entry] of Object.entries(parsed.byCode)) {
      if (!isRecord(entry) || typeof entry.nick !== "string") continue;
      const nick = canonicalPlayerNick(entry.nick);
      if (!nick || !isPlayerColor(entry.color)) continue;
      byCode[code] = { nick, color: entry.color, seen: readSeen(entry.seen) };
    }
  }

  return { lastNick, byCode };
}

function serializePlayerCookie(state: PlayerCookieState): string {
  const payload: { lastNick?: string; byCode: Record<string, PlayerIdentity> } = { byCode: state.byCode };
  if (state.lastNick) payload.lastNick = state.lastNick;
  return JSON.stringify({ lastNick: payload.lastNick, byCode: payload.byCode });
}

function omitOldest(byCode: Record<string, PlayerIdentity>, keepCode: string): Record<string, PlayerIdentity> | null {
  const codes = Object.keys(byCode);
  if (codes.length === 0) return null;

  let oldest = codes[0];
  for (const code of codes) {
    const seen = byCode[code].seen;
    const oldestSeen = byCode[oldest].seen;
    if (seen < oldestSeen || (seen === oldestSeen && oldest === keepCode && code !== keepCode)) {
      oldest = code;
    }
  }

  const next: Record<string, PlayerIdentity> = {};
  for (const code of codes) {
    if (code === oldest) continue;
    next[code] = byCode[code];
  }
  return next;
}

function randomPlayerColor(): number {
  const bytes = new Uint8Array(1);
  crypto.getRandomValues(bytes);
  return (bytes[0] % 16) + 1;
}

export function readPlayerIdentity(cookie: string | null | undefined, code: string): PlayerIdentity | null {
  return parsePlayerCookie(cookie).byCode[code] ?? null;
}

export function readLastNick(cookie: string | null | undefined): string | null {
  return parsePlayerCookie(cookie).lastNick;
}

export function writePlayerIdentity(cookie: string | null | undefined, code: string, nick: string): PlayerCookieWrite {
  const storedNick = canonicalPlayerNick(nick);
  if (!storedNick) {
    throw new Error("Invalid player nick");
  }

  const state = parsePlayerCookie(cookie);
  state.lastNick = storedNick;
  state.byCode[code] = {
    nick: storedNick,
    color: code in state.byCode ? state.byCode[code].color : randomPlayerColor(),
    seen: Date.now(),
  };

  let value = serializePlayerCookie(state);
  while (value.length > PLAYER_COOKIE_MAX_LENGTH) {
    const next = omitOldest(state.byCode, code);
    if (!next) break;
    state.byCode = next;
    value = serializePlayerCookie(state);
  }

  return {
    value,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: PLAYER_COOKIE_MAX_AGE,
  };
}
