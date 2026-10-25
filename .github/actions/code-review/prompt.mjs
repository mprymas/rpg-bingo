/** @typedef {"mg_player_boundary" | "table_isolation" | "api_contract" | "ui_contract" | "code_placement" | "test_layer"} CriterionKey */

/**
 * @typedef {{
 *   mg_player_boundary: number,
 *   table_isolation: number,
 *   api_contract: number,
 *   ui_contract: number,
 *   code_placement: number,
 *   test_layer: number,
 * }} ReviewScores
 */

/**
 * @typedef {{
 *   mg_player_boundary: string,
 *   table_isolation: string,
 *   api_contract: string,
 *   ui_contract: string,
 *   code_placement: string,
 *   test_layer: string,
 * }} ReviewSentences
 */

/**
 * @typedef {{
 *   ok: true,
 *   scores: ReviewScores,
 *   sentences: ReviewSentences,
 * }} ParsedReview
 */

/** @typedef {{ ok: false }} UnreadableReview */

const EMPTY_SENTENCE = "Brak zdania w odpowiedzi agenta.";

/** @type {readonly { key: CriterionKey, name: string }[]} */
const CRITERIA = [
  { key: "mg_player_boundary", name: "Granica MG i gracza" },
  { key: "table_isolation", name: "Izolacja stołu" },
  { key: "api_contract", name: "Kontrakt API i status błędu" },
  { key: "ui_contract", name: "Kontrakt UI" },
  { key: "code_placement", name: "Miejsce kodu i sekrety" },
  { key: "test_layer", name: "Test zachowania" },
];

/**
 * @param {string} text
 * @returns {string}
 */
function stripOneFence(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?[ \t]*\r?\n([\s\S]*)\r?\n```[ \t]*$/);
  if (!fenced?.[1]) return trimmed;
  return fenced[1].trim();
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function integerScore(value) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10) return null;
  return value;
}

/**
 * Missing, null, "", and whitespace-only sentences are empty. Any other non-string is unreadable.
 * @param {unknown} value
 * @param {boolean} missing
 * @returns {string | null}
 */
function sentenceText(value, missing) {
  if (missing || value === null) return EMPTY_SENTENCE;
  if (typeof value !== "string") return null;
  if (value.trim() === "") return EMPTY_SENTENCE;
  return value;
}

/**
 * @param {unknown} text
 * @returns {ParsedReview | UnreadableReview}
 */
export function parseReview(text) {
  if (typeof text !== "string") return { ok: false };
  let parsed;
  try {
    parsed = JSON.parse(stripOneFence(text));
  } catch {
    return { ok: false };
  }
  if (!isRecord(parsed)) return { ok: false };

  /** @type {Partial<ReviewScores>} */
  const scores = {};
  /** @type {Partial<ReviewSentences>} */
  const sentences = {};

  for (const criterion of CRITERIA) {
    const entry = parsed[criterion.key];
    if (!isRecord(entry)) return { ok: false };
    const score = integerScore(entry.score);
    if (score === null) return { ok: false };
    const sentence = sentenceText(entry.sentence, !Object.hasOwn(entry, "sentence"));
    if (sentence === null) return { ok: false };
    scores[criterion.key] = score;
    sentences[criterion.key] = sentence;
  }

  return {
    ok: true,
    scores: /** @type {ReviewScores} */ (scores),
    sentences: /** @type {ReviewSentences} */ (sentences),
  };
}

/**
 * @param {ReviewScores} scores
 * @returns {"pass" | "fail"}
 */
export function verdict(scores) {
  for (const criterion of CRITERIA) {
    const score = scores[criterion.key];
    if (!Number.isInteger(score) || score < 7 || score > 10) return "fail";
  }
  return "pass";
}

/**
 * @param {"pass" | "fail" | "infra"} kind
 * @returns {{ add: string[], remove: string[], code: number }}
 */
export function labelPlan(kind) {
  if (kind === "pass") {
    return { add: ["ai-cr:passed"], remove: ["ai-cr:failed", "ai-cr:review"], code: 0 };
  }
  if (kind === "fail") {
    return { add: ["ai-cr:failed"], remove: ["ai-cr:passed", "ai-cr:review"], code: 0 };
  }
  if (kind === "infra") {
    return { add: [], remove: ["ai-cr:passed", "ai-cr:failed"], code: 1 };
  }
  throw new Error("Unknown label plan");
}

/**
 * @param {{
 *   kind: "pass" | "fail" | "infra",
 *   runUrl: string,
 *   reason?: string,
 *   unreadable?: boolean,
 *   scores?: ReviewScores,
 *   sentences?: ReviewSentences,
 * }} input
 * @returns {string}
 */
export function formatComment(input) {
  const { kind, runUrl, reason, unreadable, scores, sentences } = input;
  /** @type {string[]} */
  const lines = ["<!-- ai-cr-review -->"];

  if (kind === "infra") {
    lines.push(`Recenzja nie doszła do werdyktu: ${reason}.`);
  } else if (unreadable) {
    lines.push("Recenzja nie dała sześciu liczb całkowitych od 1 do 10.");
    lines.push("Werdykt: fail");
  } else {
    if (!scores || !sentences) throw new Error("Scored comment requires scores and sentences");
    for (const criterion of CRITERIA) {
      lines.push(`${criterion.name} — ${scores[criterion.key]}/10 — ${sentences[criterion.key]}`);
    }
    lines.push(`Werdykt: ${kind}`);
    if (kind === "fail") {
      lines.push("Poniżej 7:");
      for (const criterion of CRITERIA) {
        const score = scores[criterion.key];
        if (score >= 1 && score <= 6) lines.push(criterion.name);
      }
    }
  }

  lines.push(`Przebieg: ${runUrl}`);
  return lines.join("\n");
}

/**
 * @param {string | null | undefined} headFullName
 * @param {string | null | undefined} baseFullName
 * @returns {boolean}
 */
export function isFork(headFullName, baseFullName) {
  if (headFullName == null || headFullName === "") return true;
  return headFullName !== baseFullName;
}

/**
 * @param {number} byteLength
 * @returns {boolean}
 */
export function diffTooLarge(byteLength) {
  return byteLength > 200000;
}

/**
 * @param {string} template
 * @param {string} title
 * @param {string} diff
 * @returns {string}
 */
export function renderPrompt(template, title, diff) {
  return template.replaceAll(/\{\{(title|diff)\}\}/g, (match) => (match === "{{title}}" ? title : diff));
}
