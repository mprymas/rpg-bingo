import { SESSION_CODE_LENGTH } from "@/types";

export const SESSION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const SESSION_CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export function generateSessionCode(): string {
  const bytes = new Uint8Array(SESSION_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let code = "";
  for (const byte of bytes) {
    code += SESSION_CODE_ALPHABET[byte & 31];
  }
  return code;
}
