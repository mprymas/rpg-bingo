#!/usr/bin/env node
/**
 * stop: sweep everything this turn changed, send the agent back once.
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

function run(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    shell: true,
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  });
}

function changedFiles() {
  const diff = run("git", ["diff", "--name-only", "HEAD"]);
  const untracked = run("git", ["ls-files", "-o", "--exclude-standard"]);
  const names = new Set();
  for (const block of [diff.stdout || "", untracked.stdout || ""]) {
    for (const line of block.split(/\r?\n/)) {
      const name = line.trim();
      if (name) names.add(name.split(path.sep).join("/"));
    }
  }
  return [...names].sort();
}

const payload = parsePayload(readStdin());
const status = payload.status ?? "completed";
const loops = Number(payload.loop_count ?? 0);

// Only after a normal finish, and only the first time.
if (status !== "completed" || loops !== 0) process.exit(0);

const changed = changedFiles();
if (changed.length === 0) process.exit(0);

const lintFiles = changed.filter((f) => LINT_EXTS.has(path.extname(f).toLowerCase()) && existsSync(f));

let report = "";

if (lintFiles.length > 0) {
  const lint = run("npx", ["eslint", "--quiet", ...lintFiles]);
  if (lint.status !== 0) {
    const out = `${lint.stdout || ""}${lint.stderr || ""}`.trim();
    report += `\nESLint errors in changed files:\n${out || "(no output)"}\n`;
  }
}

// Unit suite is ~1s here — run all of it so imports of a red module are caught.
const unit = run("npm", ["run", "test:unit"]);
if (unit.status !== 0) {
  const out = `${unit.stdout || ""}${unit.stderr || ""}`.trim();
  report += `\nUnit tests fail:\n${out || "(no output)"}\n`;
}

const check = run("npx", ["astro", "check"]);
if (check.status !== 0) {
  const out = `${check.stdout || ""}${check.stderr || ""}`.trim();
  report += `\nTypecheck (astro check) fails:\n${out || "(no output)"}\n`;
}

if (report) {
  process.stdout.write(JSON.stringify({ followup_message: `Fix these before you finish:${report}` }));
}
process.exit(0);
