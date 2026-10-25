/** @typedef {{ modelId: string, fixturesPassed: number }} WinnerRow */

/** Tie-break only. A higher fixturesPassed already won before this list is used. */
const TIE_ORDER = ["composer-2.5", "grok-4.7", "claude-sonnet-5-5"];

/**
 * @param {readonly WinnerRow[]} rows
 * @returns {string | null}
 */
export function selectWinner(rows) {
  const pool = rows.filter((row) => row.fixturesPassed >= 2);
  if (pool.length === 0) return null;

  const best = Math.max(...pool.map((row) => row.fixturesPassed));
  const tied = pool.filter((row) => row.fixturesPassed === best);
  if (tied.length === 1) return tied[0].modelId;

  for (const candidate of TIE_ORDER) {
    const winner = tied.find((row) => row.modelId === candidate || row.modelId.includes(candidate));
    if (winner) return winner.modelId;
  }
  return null;
}
