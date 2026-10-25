import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readWorkflow(name: string) {
  const path = fileURLToPath(new URL(`../../.github/workflows/${name}`, import.meta.url));
  return readFileSync(path, "utf8");
}

describe("code-review workflow", () => {
  const workflow = readWorkflow("code-review.yml");

  it("triggers on opened, synchronize, reopened, and labeled", () => {
    for (const type of ["opened", "synchronize", "reopened", "labeled"]) {
      expect(workflow).toContain(type);
    }
  });

  it("runs unless the event is a label other than ai-cr:review", () => {
    expect(workflow).toContain("github.event.action != 'labeled' || github.event.label.name == 'ai-cr:review'");
  });

  it("grants read on contents and write on pull requests and issues", () => {
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("pull-requests: write");
    expect(workflow).toContain("issues: write");
  });

  it("cancels in-progress runs in the ai-cr group", () => {
    expect(workflow).toContain("ai-cr-");
    expect(workflow).toContain("cancel-in-progress: true");
  });

  it("checks out the pull request head with full history", () => {
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("github.event.pull_request.head.sha");
  });

  it("writes the three-dot diff to an absolute workspace path", () => {
    expect(workflow).toContain("git diff origin/${{ github.event.pull_request.base.ref }}...HEAD");
    expect(workflow).toContain("${{ github.workspace }}/pr.diff");
    expect(workflow).toContain("secrets.GITHUB_TOKEN");
    expect(workflow).toContain("secrets.CURSOR_API_KEY");
  });

  it("skips checkout, diff, and the action when the fork output is true", () => {
    expect(workflow).toContain("fork=true");
    expect(workflow).toContain("fork=false");
    const skip = "if: steps.fork.outputs.fork != 'true'";
    expect(workflow.split(skip).length - 1).toBe(3);
    for (const step of ["actions/checkout@v4", "git diff origin/", "uses: ./.github/actions/code-review"]) {
      const index = workflow.indexOf(step);
      expect(index).toBeGreaterThan(-1);
      expect(workflow.slice(Math.max(0, index - 200), index)).toContain(skip);
    }
  });
});

describe("ci workflow", () => {
  it("does not contain ai-cr or @cursor/sdk", () => {
    const ci = readWorkflow("ci.yml");
    expect(ci).not.toContain("ai-cr");
    expect(ci).not.toContain("@cursor/sdk");
  });
});
