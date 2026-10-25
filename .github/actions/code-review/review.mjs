import { readFile } from "node:fs/promises";
import path from "node:path";
import { Buffer } from "node:buffer";
import { REVIEW_MODEL_ID } from "./model-id.mjs";
import { diffTooLarge, formatComment, labelPlan, parseReview, renderPrompt, verdict } from "./prompt.mjs";

const LABEL_COLORS = {
  "ai-cr:passed": "0e8a16",
  "ai-cr:failed": "d73a4a",
  "ai-cr:review": "fbca04",
};

/**
 * @param {string} repository
 * @returns {{ owner: string, repo: string }}
 */
function parseRepository(repository) {
  const parts = repository.split("/");
  if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
    throw new Error("REPOSITORY must be owner/repo");
  }
  return { owner: parts[0], repo: parts[1] };
}

/**
 * @param {string} owner
 * @param {string} repo
 * @param {string} suffix
 * @returns {string}
 */
function repoPath(owner, repo, suffix) {
  return `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}${suffix}`;
}

/**
 * @param {string} token
 * @param {string} method
 * @param {string} pathname
 * @param {unknown} [body]
 */
async function github(token, method, pathname, body) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "rpg-bingo-code-review",
  };
  /** @type {{ method: string, headers: Record<string, string>, body?: string }} */
  const init = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`https://api.github.com${pathname}`, init);
  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

/**
 * @param {{ status: number, text: string }} response
 * @returns {boolean}
 */
function labelAlreadyExists(response) {
  if (response.status !== 422) return false;
  try {
    const payload = JSON.parse(response.text);
    if (typeof payload !== "object" || payload === null) return false;
    if (Array.isArray(payload.errors)) {
      for (const error of payload.errors) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "already_exists") {
          return true;
        }
      }
    }
    return typeof payload.message === "string" && payload.message.toLowerCase().includes("already exists");
  } catch {
    return false;
  }
}

/**
 * @param {string} method
 * @param {string} pathname
 * @param {{ status: number, text: string }} response
 * @returns {Error}
 */
function githubFailure(method, pathname, response) {
  const detail = response.text.trim().slice(0, 300);
  return new Error(`GitHub ${method} ${pathname} failed: ${String(response.status)} ${detail}`);
}

/**
 * @param {{ owner: string, repo: string, pr: string, token: string }} context
 * @param {{ add: string[], remove: string[] }} plan
 * @param {string} body
 */
async function publish(context, plan, body) {
  const { owner, repo, pr, token } = context;

  for (const name of plan.add) {
    const color = LABEL_COLORS[name];
    if (typeof color !== "string") throw new Error(`No color configured for ${name}`);
    const pathname = repoPath(owner, repo, "/labels");
    const created = await github(token, "POST", pathname, { name, color });
    if (created.ok || labelAlreadyExists(created)) continue;
    throw githubFailure("POST", pathname, created);
  }

  for (const name of plan.remove) {
    const pathname = repoPath(owner, repo, `/issues/${encodeURIComponent(pr)}/labels/${encodeURIComponent(name)}`);
    const removed = await github(token, "DELETE", pathname);
    if (removed.ok || removed.status === 404) continue;
    throw githubFailure("DELETE", pathname, removed);
  }

  if (plan.add.length > 0) {
    const pathname = repoPath(owner, repo, `/issues/${encodeURIComponent(pr)}/labels`);
    const added = await github(token, "POST", pathname, { labels: plan.add });
    if (!added.ok) throw githubFailure("POST", pathname, added);
  }

  const commentPath = repoPath(owner, repo, `/issues/${encodeURIComponent(pr)}/comments`);
  const commented = await github(token, "POST", commentPath, { body });
  if (!commented.ok) throw githubFailure("POST", commentPath, commented);
}

/**
 * @param {{ owner: string, repo: string, pr: string, token: string, runUrl: string }} context
 * @param {"pass" | "fail" | "infra"} kind
 * @param {{ reason?: string, unreadable?: boolean, scores?: object, sentences?: object }} extra
 * @returns {Promise<number>}
 */
async function publishOutcome(context, kind, extra) {
  const plan = labelPlan(kind);
  const body = formatComment({ kind, runUrl: context.runUrl, ...extra });
  await publish(context, plan, body);
  return plan.code;
}

function logFailure(error) {
  const secrets = [process.env.CURSOR_API_KEY, process.env.GH_TOKEN].filter(
    (value) => typeof value === "string" && value.length > 0,
  );
  let message = error instanceof Error ? error.message : "review failed";
  for (const secret of secrets) {
    message = message.split(secret).join("[redacted]");
  }
  console.error(message);
}

async function main() {
  const { owner, repo } = parseRepository(process.env.REPOSITORY ?? "");
  const context = {
    owner,
    repo,
    pr: process.env.PR_NUMBER ?? "",
    token: process.env.GH_TOKEN ?? "",
    runUrl: process.env.RUN_URL ?? "",
  };

  if (typeof REVIEW_MODEL_ID !== "string" || REVIEW_MODEL_ID.trim() === "") {
    return publishOutcome(context, "infra", { reason: "brak identyfikatora modelu" });
  }

  const apiKey = process.env.CURSOR_API_KEY;
  if (typeof apiKey !== "string" || apiKey.trim() === "") {
    return publishOutcome(context, "infra", { reason: "brak CURSOR_API_KEY" });
  }

  const diffPath = process.env.DIFF_PATH;
  if (typeof diffPath !== "string" || diffPath === "") {
    throw new Error("DIFF_PATH is not set");
  }
  const diff = await readFile(diffPath, "utf8");
  if (diffTooLarge(Buffer.byteLength(diff))) {
    return publishOutcome(context, "infra", { reason: "diff powyżej 200000 bajtów" });
  }

  const template = await readFile(path.join(import.meta.dirname, "prompt.txt"), "utf8");
  const renderedPrompt = renderPrompt(template, process.env.PR_TITLE ?? "", diff);
  const workspace = process.env.GITHUB_WORKSPACE;
  const cwd =
    typeof workspace === "string" && workspace.trim() !== ""
      ? workspace
      : path.resolve(import.meta.dirname, "..", "..", "..");

  const { Agent, CursorAgentError } = await import("@cursor/sdk");

  let result;
  try {
    result = await Agent.prompt(renderedPrompt, {
      apiKey,
      model: { id: REVIEW_MODEL_ID },
      local: { cwd },
      tools: [],
    });
  } catch (error) {
    if (error instanceof CursorAgentError) {
      return publishOutcome(context, "infra", { reason: "błąd startu agenta" });
    }
    throw error;
  }

  if (result.status === "error") {
    return publishOutcome(context, "infra", { reason: "status error" });
  }
  if (result.status === "cancelled") {
    return publishOutcome(context, "infra", { reason: "status cancelled" });
  }
  if (result.status !== "finished") {
    throw new Error(`Unexpected agent status: ${String(result.status)}`);
  }

  const text = typeof result.result === "string" ? result.result : "";
  const parsed = parseReview(text);
  if (!parsed.ok) {
    return publishOutcome(context, "fail", { unreadable: true });
  }
  const kind = verdict(parsed.scores);
  return publishOutcome(context, kind, { scores: parsed.scores, sentences: parsed.sentences });
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error) => {
    logFailure(error);
    process.exit(1);
  });
