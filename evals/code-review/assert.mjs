import { parseReview, verdict } from "../../.github/actions/code-review/prompt.mjs";

const CRITERION_KEYS = [
  "mg_player_boundary",
  "table_isolation",
  "api_contract",
  "ui_contract",
  "code_placement",
  "test_layer",
];

/** @type {ReadonlySet<string>} */
const CRITERION_KEY_SET = new Set(CRITERION_KEYS);

/**
 * @param {string} key
 * @returns {key is "mg_player_boundary" | "table_isolation" | "api_contract" | "ui_contract" | "code_placement" | "test_layer"}
 */
function isCriterionKey(key) {
  return CRITERION_KEY_SET.has(key);
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {string} reason
 * @returns {{ pass: false, score: 0, reason: string }}
 */
function fail(reason) {
  return { pass: false, score: 0, reason };
}

/**
 * @param {unknown} output
 * @param {{ vars?: Record<string, unknown> }} [context]
 * @returns {{ pass: boolean, score: number, reason: string }}
 */
export default function gradeFixture(output, context = {}) {
  const parsed = parseReview(output);
  if (!parsed.ok) return fail("parseReview did not yield six scores");

  const vars = context.vars ?? {};
  const expectedVerdict = vars.expectedVerdict;
  if (expectedVerdict !== "pass" && expectedVerdict !== "fail") return fail("expectedVerdict is missing");

  const actualVerdict = verdict(parsed.scores);
  if (actualVerdict !== expectedVerdict) {
    return fail(`verdict ${actualVerdict} != ${expectedVerdict}`);
  }

  if (!isRecord(vars.bands)) return fail("bands are missing");

  for (const [key, band] of Object.entries(vars.bands)) {
    if (!isCriterionKey(key)) return fail(`Unknown band ${key}`);
    if (!isRecord(band) || typeof band.min !== "number" || typeof band.max !== "number") {
      return fail(`Band ${key} needs numeric min and max`);
    }
    const score = parsed.scores[key];
    if (score < band.min || score > band.max) {
      return fail(`${key} score ${String(score)} is outside ${String(band.min)}-${String(band.max)}`);
    }
  }

  const phraseKey = vars.phraseKey;
  const phrasePattern = vars.phrasePattern;
  const hasKey = typeof phraseKey === "string" && phraseKey !== "";
  const hasPattern = typeof phrasePattern === "string" && phrasePattern !== "";
  if (hasKey !== hasPattern) return fail("phraseKey and phrasePattern must be set together");
  if (!hasKey || !hasPattern) return { pass: true, score: 1, reason: "Fixture passed" };
  if (!isCriterionKey(phraseKey)) return fail(`Unknown phraseKey ${phraseKey}`);

  let pattern;
  try {
    pattern = new RegExp(phrasePattern, "i");
  } catch {
    return fail("phrasePattern is not a regular expression");
  }
  if (!pattern.test(parsed.sentences[phraseKey])) {
    return fail(`${phraseKey} sentence did not match /${phrasePattern}/i`);
  }
  return { pass: true, score: 1, reason: "Fixture passed" };
}
