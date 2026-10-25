import { normalizePhrase } from "@/lib/services/board-generator";

export type RerollPhraseErrorCode = "POOL_EMPTY";

export class RerollPhraseError extends Error {
  readonly code: RerollPhraseErrorCode;

  constructor(code: RerollPhraseErrorCode) {
    super(code);
    this.name = "RerollPhraseError";
    this.code = code;
  }
}

/** Same half-open unit interval `generateBoard` uses when the caller does not inject `random`. */
function defaultRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

/**
 * One catalog phrase whose normalized form is not on the board the GM currently sees.
 * Catalog rows that normalize to the same string count once; the first exact `phrases.text` wins.
 * A visible custom that is not in the catalog excludes that form and is never returned.
 */
export function pickCatalogPhrase(input: {
  catalog: readonly string[];
  visiblePhrases: readonly string[];
  random?: () => number;
}): string {
  const random = input.random ?? defaultRandom;
  const visible = new Set(input.visiblePhrases.map((phrase) => normalizePhrase(phrase)));
  const eligibleByNorm = new Map<string, string>();

  for (const text of input.catalog) {
    const key = normalizePhrase(text);
    if (visible.has(key)) continue;
    if (!eligibleByNorm.has(key)) {
      eligibleByNorm.set(key, text);
    }
  }

  const eligible = [...eligibleByNorm.values()];
  if (eligible.length === 0) {
    throw new RerollPhraseError("POOL_EMPTY");
  }

  return eligible[Math.floor(random() * eligible.length)];
}
