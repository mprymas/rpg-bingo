import { describe, expect, it } from "vitest";
import {
  diffTooLarge,
  formatComment,
  isFork,
  labelPlan,
  parseReview,
  verdict,
} from "../../.github/actions/code-review/prompt.mjs";

const SENTENCE = "Krótkie zdanie.";
const RUN_URL = "https://github.com/acme/rpg-bingo/actions/runs/15";

const KEYS = [
  "mg_player_boundary",
  "table_isolation",
  "api_contract",
  "ui_contract",
  "code_placement",
  "test_layer",
] as const;

const NAMES = [
  "Granica MG i gracza",
  "Izolacja stołu",
  "Kontrakt API i status błędu",
  "Kontrakt UI",
  "Miejsce kodu i sekrety",
  "Test zachowania",
] as const;

type ReviewKey = (typeof KEYS)[number];
type ScoreInput = number | string;
type SentenceInput = string | null | undefined;
type SixScores = readonly [ScoreInput, ScoreInput, ScoreInput, ScoreInput, ScoreInput, ScoreInput];
type SixSentences = readonly [SentenceInput, SentenceInput, SentenceInput, SentenceInput, SentenceInput, SentenceInput];

function reviewText(options: { scores: SixScores; sentences?: SixSentences; omit?: ReviewKey }): string {
  const body: Record<string, { score: ScoreInput; sentence?: string | null }> = {};
  KEYS.forEach((key, index) => {
    if (key === options.omit) return;
    const entry: { score: ScoreInput; sentence?: string | null } = { score: options.scores[index] };
    if (options.sentences) {
      const sentence = options.sentences[index];
      if (sentence !== undefined) entry.sentence = sentence;
    } else {
      entry.sentence = SENTENCE;
    }
    body[key] = entry;
  });
  return JSON.stringify(body);
}

function expectScores(
  text: string,
  scores: readonly [number, number, number, number, number, number],
  verdictWord: "pass" | "fail",
) {
  const parsed = parseReview(text);
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) return;
  expect(parsed.scores).toEqual({
    mg_player_boundary: scores[0],
    table_isolation: scores[1],
    api_contract: scores[2],
    ui_contract: scores[3],
    code_placement: scores[4],
    test_layer: scores[5],
  });
  expect(verdict(parsed.scores)).toBe(verdictWord);
  return parsed;
}

describe("verdict", () => {
  it("passes when every score is 7, 10, or a mix of 7–10", () => {
    expectScores(reviewText({ scores: [7, 7, 7, 7, 7, 7] }), [7, 7, 7, 7, 7, 7], "pass");
    expectScores(reviewText({ scores: [10, 10, 10, 10, 10, 10] }), [10, 10, 10, 10, 10, 10], "pass");
    expectScores(reviewText({ scores: [7, 8, 9, 10, 8, 7] }), [7, 8, 9, 10, 8, 7], "pass");
  });

  it("fails when one score is 6 and the rest are 10", () => {
    expectScores(reviewText({ scores: [10, 10, 6, 10, 10, 10] }), [10, 10, 6, 10, 10, 10], "fail");
  });

  it("fails when one score is 4 and the rest are 10", () => {
    expectScores(reviewText({ scores: [10, 4, 10, 10, 10, 10] }), [10, 4, 10, 10, 10, 10], "fail");
  });
});

describe("parseReview", () => {
  it("strips one json fence and one bare fence before parsing", () => {
    const json = reviewText({ scores: [8, 8, 8, 8, 8, 9] });
    expectScores(`\n\`\`\`json\n${json}\n\`\`\`\n`, [8, 8, 8, 8, 8, 9], "pass");
    expectScores(`\`\`\`\n${json}\n\`\`\``, [8, 8, 8, 8, 8, 9], "pass");
  });

  it("replaces an empty sentence and still passes valid scores", () => {
    const parsed = parseReview(
      reviewText({
        scores: [8, 9, 10, 7, 8, 8],
        sentences: ["", "   ", null, undefined, "Kontrakt trzyma schemat.", "Test leży obok reguły."],
      }),
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(verdict(parsed.scores)).toBe("pass");
    expect(parsed.sentences.mg_player_boundary).toBe("Brak zdania w odpowiedzi agenta.");
    expect(parsed.sentences.table_isolation).toBe("Brak zdania w odpowiedzi agenta.");
    expect(parsed.sentences.api_contract).toBe("Brak zdania w odpowiedzi agenta.");
    expect(parsed.sentences.ui_contract).toBe("Brak zdania w odpowiedzi agenta.");
    expect(parsed.sentences.code_placement).toBe("Kontrakt trzyma schemat.");
    expect(parsed.sentences.test_layer).toBe("Test leży obok reguły.");
  });

  it("rejects a fraction, 0, 11, a missing key, two objects, prose, a string score, and an array", () => {
    expect(parseReview(reviewText({ scores: [7.5, 10, 10, 10, 10, 10] })).ok).toBe(false);
    expect(parseReview(reviewText({ scores: [0, 10, 10, 10, 10, 10] })).ok).toBe(false);
    expect(parseReview(reviewText({ scores: [11, 10, 10, 10, 10, 10] })).ok).toBe(false);
    expect(parseReview(reviewText({ scores: [8, 8, 8, 8, 8, 8], omit: "ui_contract" })).ok).toBe(false);
    const one = reviewText({ scores: [8, 8, 8, 8, 8, 8] });
    expect(parseReview(`${one}\n${one}`).ok).toBe(false);
    expect(parseReview("To jest proza, nie obiekt JSON.").ok).toBe(false);
    expect(parseReview(reviewText({ scores: ["8", 10, 10, 10, 10, 10] })).ok).toBe(false);
    expect(parseReview(`[${one}]`).ok).toBe(false);
  });

  it("keeps a valid review when the object has an extra key", () => {
    const text = reviewText({ scores: [8, 8, 8, 8, 8, 8] }).replace(/^\{/, '{"note":"ignored",');
    expectScores(text, [8, 8, 8, 8, 8, 8], "pass");
  });
});

describe("labelPlan", () => {
  it("adds the pass label, removes fail and review, and exits 0", () => {
    expect(labelPlan("pass")).toEqual({
      add: ["ai-cr:passed"],
      remove: ["ai-cr:failed", "ai-cr:review"],
      code: 0,
    });
  });

  it("adds the fail label, removes pass and review, and exits 0", () => {
    expect(labelPlan("fail")).toEqual({
      add: ["ai-cr:failed"],
      remove: ["ai-cr:passed", "ai-cr:review"],
      code: 0,
    });
  });

  it("adds nothing for infra, removes both result labels, leaves review, and exits 1", () => {
    expect(labelPlan("infra")).toEqual({
      add: [],
      remove: ["ai-cr:passed", "ai-cr:failed"],
      code: 1,
    });
  });
});

describe("formatComment", () => {
  it("lists six Polish names, the verdict, and the run url on pass", () => {
    const scores = [7, 8, 9, 10, 8, 7] as const;
    const parsed = expectScores(reviewText({ scores }), scores, "pass");
    if (!parsed) return;
    const body = formatComment({
      kind: "pass",
      runUrl: RUN_URL,
      scores: parsed.scores,
      sentences: parsed.sentences,
    });
    expect(body).toBe(
      [
        "<!-- ai-cr-review -->",
        ...NAMES.map((name, index) => `${name} — ${scores[index]}/10 — ${SENTENCE}`),
        "Werdykt: pass",
        `Przebieg: ${RUN_URL}`,
      ].join("\n"),
    );
    expect(body).not.toContain("Poniżej 7:");
  });

  it("lists only the criteria below 7 on a scored fail", () => {
    const scores = [10, 10, 10, 4, 10, 6] as const;
    const parsed = expectScores(reviewText({ scores }), scores, "fail");
    if (!parsed) return;
    const body = formatComment({
      kind: verdict(parsed.scores),
      runUrl: RUN_URL,
      scores: parsed.scores,
      sentences: parsed.sentences,
    });
    expect(body).toBe(
      [
        "<!-- ai-cr-review -->",
        ...NAMES.map((name, index) => `${name} — ${scores[index]}/10 — ${SENTENCE}`),
        "Werdykt: fail",
        "Poniżej 7:",
        "Kontrakt UI",
        "Test zachowania",
        `Przebieg: ${RUN_URL}`,
      ].join("\n"),
    );
  });

  it("uses the unreadable fail text and invents no scores", () => {
    expect(formatComment({ kind: "fail", unreadable: true, runUrl: RUN_URL })).toBe(
      [
        "<!-- ai-cr-review -->",
        "Recenzja nie dała sześciu liczb całkowitych od 1 do 10.",
        "Werdykt: fail",
        `Przebieg: ${RUN_URL}`,
      ].join("\n"),
    );
  });

  it("states the infra reason and ends with the run url", () => {
    const reasons = [
      "brak CURSOR_API_KEY",
      "błąd startu agenta",
      "status error",
      "status cancelled",
      "diff powyżej 200000 bajtów",
      "brak identyfikatora modelu",
    ];
    for (const reason of reasons) {
      expect(formatComment({ kind: "infra", reason, runUrl: RUN_URL })).toBe(
        ["<!-- ai-cr-review -->", `Recenzja nie doszła do werdyktu: ${reason}.`, `Przebieg: ${RUN_URL}`].join("\n"),
      );
    }
  });
});

describe("isFork", () => {
  it("is true for an empty head or a different full name, and false when the names match", () => {
    expect(isFork("", "acme/rpg-bingo")).toBe(true);
    expect(isFork(null, "acme/rpg-bingo")).toBe(true);
    expect(isFork(undefined, "acme/rpg-bingo")).toBe(true);
    expect(isFork("other/rpg-bingo", "acme/rpg-bingo")).toBe(true);
    expect(isFork("acme/rpg-bingo", "acme/rpg-bingo")).toBe(false);
  });
});

describe("diffTooLarge", () => {
  it("is false at 200000 bytes and true above that", () => {
    expect(diffTooLarge(200000)).toBe(false);
    expect(diffTooLarge(200001)).toBe(true);
  });
});
