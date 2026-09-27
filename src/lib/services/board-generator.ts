import type { BoardSize, CustomPhraseInput, GeneratedCell, RewardCountInput } from "@/types";

export type BoardGenerationErrorCode = "TOO_MANY_GUARANTEED" | "POOL_TOO_SMALL" | "TOO_MANY_REWARDS";

export class BoardGenerationError extends Error {
  readonly code: BoardGenerationErrorCode;
  readonly missing?: number;

  constructor(code: BoardGenerationErrorCode, options?: { missing?: number }) {
    super(code);
    this.name = "BoardGenerationError";
    this.code = code;
    if (options?.missing !== undefined) {
      this.missing = options.missing;
    }
  }
}

export function normalizePhrase(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLocaleLowerCase("pl");
}

function defaultRandom(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 2 ** 32;
}

function shuffleInPlace(items: unknown[], random: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
}

function sampleWithoutReplacement(items: string[], count: number, random: () => number): string[] {
  const pool = [...items];
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(random() * (pool.length - i));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, count);
}

export function generateBoard(input: {
  size: BoardSize;
  predefined: string[];
  customPhrases: CustomPhraseInput[];
  rewards: RewardCountInput[];
  random?: () => number;
}): GeneratedCell[] {
  const random = input.random ?? defaultRandom;
  const cells = input.size * input.size;

  // 1. Trim customs; drop empty; collapse duplicates by normalized form.
  const customByNorm = new Map<string, CustomPhraseInput>();
  for (const custom of input.customPhrases) {
    const text = custom.text.trim();
    if (text.length === 0) continue;
    const key = normalizePhrase(text);
    const existing = customByNorm.get(key);
    if (existing) {
      existing.guaranteed = existing.guaranteed || custom.guaranteed;
    } else {
      customByNorm.set(key, { text, guaranteed: custom.guaranteed });
    }
  }
  const customs = [...customByNorm.values()];

  // 2. Custom wins over matching predefined — remove predefined from pool.
  const customNorms = new Set(customs.map((c) => normalizePhrase(c.text)));
  const remainingPredefined = input.predefined.filter((phrase) => !customNorms.has(normalizePhrase(phrase)));

  const guaranteed = customs.filter((c) => c.guaranteed);
  const nonGuaranteed = customs.filter((c) => !c.guaranteed);
  const guaranteedCount = guaranteed.length;

  // 3. Guaranteed must fit on the board.
  if (guaranteedCount > cells) {
    throw new BoardGenerationError("TOO_MANY_GUARANTEED");
  }

  // 4. Pool = non-guaranteed customs + remaining predefined.
  const pool = [...nonGuaranteed.map((c) => c.text), ...remainingPredefined];
  const neededFromPool = cells - guaranteedCount;
  if (pool.length < neededFromPool) {
    throw new BoardGenerationError("POOL_TOO_SMALL", {
      missing: neededFromPool - pool.length,
    });
  }

  // 5. All guaranteed + draw from pool; shuffle into positions.
  const drawn = sampleWithoutReplacement(pool, neededFromPool, random);
  const phrases = [...guaranteed.map((c) => c.text), ...drawn];
  shuffleInPlace(phrases, random);

  const result: GeneratedCell[] = phrases.map((phrase, position) => ({
    position,
    phrase,
    rewardId: null,
  }));

  // 6. Expand rewards and assign to distinct random positions.
  const rewardList: string[] = [];
  for (const { rewardId, count } of input.rewards) {
    if (count === 0) continue;
    for (let i = 0; i < count; i++) {
      rewardList.push(rewardId);
    }
  }
  if (rewardList.length > cells) {
    throw new BoardGenerationError("TOO_MANY_REWARDS");
  }

  const positions = Array.from({ length: cells }, (_, i) => i);
  shuffleInPlace(positions, random);
  for (let i = 0; i < rewardList.length; i++) {
    result[positions[i]].rewardId = rewardList[i];
  }

  return result;
}
