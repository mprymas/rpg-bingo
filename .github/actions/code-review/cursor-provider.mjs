import path from "node:path";

/**
 * @typedef {{ ok: true, id: string } | { ok: false, ids: string[] }} ModelResolution
 */

/**
 * Exact `id` wins. Otherwise the single id that contains `candidate`.
 * Zero hits, or more than one containing id, do not resolve — no `fast` / `high` guess.
 * @param {string} candidate
 * @param {readonly { id: string }[]} models
 * @returns {ModelResolution}
 */
export function resolveModelId(candidate, models) {
  const ids = models.map((model) => model.id);
  if (candidate === "") return { ok: false, ids };
  if (ids.includes(candidate)) return { ok: true, id: candidate };

  const matches = ids.filter((id) => id.includes(candidate));
  if (matches.length === 1) return { ok: true, id: matches[0] };
  return { ok: false, ids };
}

export default class CursorProvider {
  /** @type {string} */
  model;

  /** @type {string} */
  providerId;

  /**
   * @param {{ id?: string, config?: { model?: string } }} [options]
   */
  constructor(options = {}) {
    const config = options?.config;
    this.model = typeof config?.model === "string" ? config.model : "";
    this.providerId = typeof options?.id === "string" && options.id !== "" ? options.id : "cursor-provider";
  }

  /**
   * @returns {string}
   */
  id() {
    return `${this.providerId}:${this.model}`;
  }

  /**
   * @param {string} prompt
   * @returns {Promise<{ output: string } | { error: string }>}
   */
  async callApi(prompt) {
    const workspace = process.env.GITHUB_WORKSPACE;
    const cwd =
      typeof workspace === "string" && workspace.trim() !== ""
        ? workspace
        : path.resolve(import.meta.dirname, "..", "..", "..");

    const { Agent, Cursor } = await import("@cursor/sdk");
    const models = await Cursor.models.list({ apiKey: process.env.CURSOR_API_KEY });
    const resolved = resolveModelId(this.model, models);
    if (!resolved.ok) {
      console.error(resolved.ids.join("\n"));
      throw new Error(`Cannot resolve model ${this.model}`);
    }

    const result = await Agent.prompt(prompt, {
      apiKey: process.env.CURSOR_API_KEY,
      model: { id: resolved.id },
      local: { cwd },
      tools: [],
    });

    if (result.status === "finished") {
      return { output: result.result ?? "" };
    }
    if (result.status === "error" || result.status === "cancelled") {
      const message = result.error?.message;
      return { error: typeof message === "string" && message !== "" ? message : `status ${result.status}` };
    }
    return { error: `Unexpected agent status: ${String(result.status)}` };
  }
}
