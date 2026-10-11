import type { CloseErrorReason } from "@/types";

export const CLOSE_ERROR_MESSAGES: Record<CloseErrorReason, string> = {
  SESSION_NOT_FOUND: "Nie udało się zamknąć poprzedniej sesji — nie znaleziono sesji źródłowej",
  SESSION_NOT_ACTIVE: "Nie udało się zamknąć poprzedniej sesji — jest już zamknięta",
  REPLACEMENT_NOT_FOUND: "Nie udało się zamknąć poprzedniej sesji — brak sesji zastępczej",
  UNKNOWN: "Nie udało się zamknąć poprzedniej sesji",
};

/** `?closeFailed=` value → known reason; any other non-empty value (e.g. legacy `1`) → UNKNOWN. */
export function parseCloseErrorReason(value: string | null): CloseErrorReason | null {
  if (!value) return null;
  return Object.hasOwn(CLOSE_ERROR_MESSAGES, value) ? (value as CloseErrorReason) : "UNKNOWN";
}
