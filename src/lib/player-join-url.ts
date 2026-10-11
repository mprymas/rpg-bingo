/**
 * Canonical absolute join URL shared by QR UI, kitchen-sink demos, and tests.
 * Code is trimmed and uppercased the same way callers satisfy SESSION_CODE_PATTERN.
 */
export function buildPlayerJoinUrl(origin: string, code: string): string {
  const base = origin.endsWith("/") ? origin.slice(0, -1) : origin;
  const normalized = code.trim().toUpperCase();
  return `${base}/play/${normalized}?join=1`;
}
