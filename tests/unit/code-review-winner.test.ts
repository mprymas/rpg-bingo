import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { resolveModelId } from "../../.github/actions/code-review/cursor-provider.mjs";
import { selectWinner } from "../../.github/actions/code-review/select-winner.mjs";
import gradeFixture from "../../evals/code-review/assert.mjs";

const composer = "composer-2.5";
const grok = "grok-4.7";
const sonnet = "claude-sonnet-5-5";

function row(modelId: string, fixturesPassed: number) {
  return { modelId, fixturesPassed };
}

describe("selectWinner", () => {
  it("returns null when every model is below 2", () => {
    expect(selectWinner([row(composer, 1), row(grok, 0), row(sonnet, 1)])).toBeNull();
  });

  it("returns the only model id that reached 2", () => {
    expect(selectWinner([row(composer, 1), row("grok-4.7-high", 2), row(sonnet, 0)])).toBe("grok-4.7-high");
  });

  it("breaks a tie at 2 between composer-2.5 and grok-4.7 toward the composer id", () => {
    expect(selectWinner([row(grok, 2), row(composer, 2), row(sonnet, 1)])).toBe(composer);
  });

  it("breaks a tie at 2 between grok-4.7 and claude-sonnet-5-5 toward the grok id when composer is below 2", () => {
    expect(selectWinner([row(composer, 1), row(sonnet, 2), row(grok, 2)])).toBe(grok);
  });

  it("breaks a three-way tie at 2 toward the composer id", () => {
    expect(selectWinner([row(sonnet, 2), row(grok, 2), row(composer, 2)])).toBe(composer);
  });

  it("prefers a resolved id that contains composer-2.5 over one that contains grok-4.7", () => {
    expect(selectWinner([row("grok-4.7-high", 2), row("composer-2.5-fast", 2), row(sonnet, 0)])).toBe(
      "composer-2.5-fast",
    );
  });

  it("prefers sonnet at 3 over composer at 2", () => {
    expect(selectWinner([row(composer, 2), row(grok, 0), row(sonnet, 3)])).toBe(sonnet);
  });
});

describe("resolveModelId", () => {
  it("uses an exact id when a longer id also contains the name", () => {
    expect(
      resolveModelId(composer, [{ id: "composer-2.5-fast" }, { id: composer }, { id: "composer-2.5-high" }]),
    ).toEqual({ ok: true, id: composer });
  });

  it("uses the single id that contains the name when no exact id exists", () => {
    expect(resolveModelId(grok, [{ id: "grok-4.7-high" }, { id: sonnet }])).toEqual({
      ok: true,
      id: "grok-4.7-high",
    });
  });

  it("does not return an id when nothing matches", () => {
    expect(resolveModelId(composer, [{ id: grok }, { id: sonnet }])).toEqual({
      ok: false,
      ids: [grok, sonnet],
    });
  });

  it("does not return an id when fast and high both contain the name and neither is exact", () => {
    expect(resolveModelId(composer, [{ id: "composer-2.5-fast" }, { id: "composer-2.5-high" }])).toEqual({
      ok: false,
      ids: ["composer-2.5-fast", "composer-2.5-high"],
    });
  });
});

describe("gradeFixture", () => {
  it("returns a promptfoo GradingResult with a numeric score", () => {
    const failed = gradeFixture("nie json", { vars: {} });
    expect(failed).toEqual({
      pass: false,
      score: 0,
      reason: "parseReview did not yield six scores",
    });

    const review = Object.fromEntries(
      ["mg_player_boundary", "table_isolation", "api_contract", "ui_contract", "code_placement", "test_layer"].map(
        (key) => [key, { score: 8, sentence: "Zdanie." }],
      ),
    );
    expect(
      gradeFixture(JSON.stringify(review), {
        vars: {
          expectedVerdict: "pass",
          bands: { mg_player_boundary: { min: 7, max: 10 } },
        },
      }),
    ).toEqual({ pass: true, score: 1, reason: "Fixture passed" });
  });
});

describe("promptfooconfig", () => {
  it("names the three models, the three fixtures, and the provider, without llm-rubric", () => {
    const yamlPath = fileURLToPath(new URL("../../evals/code-review/promptfooconfig.yaml", import.meta.url));
    const yaml = readFileSync(yamlPath, "utf8");
    for (const needle of [
      composer,
      grok,
      sonnet,
      "secret-in-diff.diff",
      "mg-route-without-auth.diff",
      "clean-handler.diff",
      "cursor-provider.mjs",
      "prompt.txt",
    ]) {
      expect(yaml).toContain(needle);
    }
    expect(yaml).not.toContain("llm-rubric");
  });
});
