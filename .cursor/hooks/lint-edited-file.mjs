#!/usr/bin/env node
/**
 * postToolUse (Write): lint the edited file; errors go back as additional_context.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

process.env.NO_COLOR = "1";
process.env.FORCE_COLOR = "0";

const root = process.env.CURSOR_PROJECT_DIR || process.cwd();
try {
  process.chdir(root);
} catch {
  process.exit(0);
}

const LINT_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".astro"]);

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parsePayload(raw) {
  if (!raw || !String(raw).trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function extractFile(payload) {
  const input = payload?.tool_input;
  if (!input || typeof input !== "object") return "";
  for (const key of ["file_path", "path", "target_file"]) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toProjectRelative(filePath) {
  if (!filePath) return "";
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
  const rel = path.relative(root, abs);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) return "";
  return rel.split(path.sep).join("/");
}

const payload = parsePayload(readStdin());
const file = toProjectRelative(extractFile(payload));
if (!file) process.exit(0);

const ext = path.extname(file).toLowerCase();
if (!LINT_EXTS.has(ext)) process.exit(0);
if (!existsSync(file)) process.exit(0);

const result = spawnSync("npx", ["eslint", "--quiet", file], {
  encoding: "utf8",
  shell: true,
  env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
});

if (result.status === 0) process.exit(0);

const output = `${result.stdout || ""}${result.stderr || ""}`.trim();
const msg = `ESLint reported errors in ${file}:\n${output || "(no output)"}`;
process.stdout.write(JSON.stringify({ additional_context: msg }));
process.exit(0);
