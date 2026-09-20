---
bootstrapped_at: 2026-09-19T10:32:22Z
starter_id: 10x-astro-starter
starter_name: 10x Astro Starter (Astro + Supabase + Cloudflare)
project_name: rpg-bingo
language_family: js
package_manager: npm
cwd_strategy: git-clone
bootstrapper_confidence: first-class
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

Verbatim copy of `context/foundation/tech-stack.md` frontmatter and body at the time of this run.

```yaml
starter_id: 10x-astro-starter
package_manager: npm
project_name: rpg-bingo
hints:
  language_family: js
  team_size: solo
  deployment_target: cloudflare-pages
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: first-class
  path_taken: standard
  quality_override: false
  self_check_answers: null
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: false
```

### Why this stack

A solo developer building RPG Bingo after hours, with a 3-week MVP window and a hard deadline of 2026-11-04, needs a starter that ships auth, a relational database, and deployment already wired together. 10x Astro Starter (Astro 7 + React 19 + TypeScript + Tailwind 4 + Supabase + Cloudflare Pages) is the recommended default for a JavaScript web-app and clears all four agent-friendly gates. Supabase covers the Game Master login (FR-001) and gives Postgres constraints to enforce the "one field, one owner" guardrail even on near-simultaneous clicks; the anonymous player join by session code (FR-002) is plain application logic. The PRD explicitly makes live sync a non-goal and accepts a 10-second visibility window, so board refresh is handled by polling rather than websockets, and the realtime flag is off; Supabase Realtime remains available later if FR-013 is promoted. Small scale and low QPS fit Cloudflare's free tier. Scaffolding confidence is first-class, so expect mostly-smooth bootstrapping with occasional manual steps. CI on GitHub Actions with auto-deploy on merge, the starter's standard shape.

## Pre-scaffold verification

| Signal      | Value                                                              | Severity | Notes                                                                                                   |
| ----------- | ------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------- |
| npm package | not run                                                            | n/a      | `cmd_template` starts with `git clone`; no `create-*` package to resolve                                |
| GitHub repo | `przeprogramowani/10x-astro-starter` last pushed 2026-09-12T21:16:08Z | fresh    | from card.docs_url; `gh` CLI not installed locally, fetched via GitHub REST API (`api.github.com/repos/...`) |

Local toolchain observed at run time (informational): node v26.9.0, npm 11.19.1, git 2.21.0.windows.1. Registry card pins `runtime_version: node 22`; the starter ships `.nvmrc` — check it if you hit a Node-version mismatch.

## Scaffold log

**Resolved invocation**: `git clone https://github.com/przeprogramowani/10x-astro-starter .bootstrap-scaffold && cd .bootstrap-scaffold && npm install`
**Strategy**: git-clone
**Exit code**: 0
**Files moved**: 22 top-level entries (52 project files excluding `node_modules/`; `node_modules/` moved as-is with 648 installed packages)
**Conflicts (.scaffold siblings)**: none
**.gitignore handling**: moved silently (absent in cwd)
**.bootstrap-scaffold cleanup**: deleted (`.bootstrap-scaffold/.git/` removed before move-up; 0 leftover paths)

Top-level entries moved into cwd:

`.github/`, `.husky/`, `.vscode/`, `node_modules/`, `public/`, `scripts/`, `src/`, `supabase/`, `.env.example`, `.gitignore`, `.nvmrc`, `.prettierrc.json`, `AGENTS.md`, `astro.config.mjs`, `CLAUDE.md`, `components.json`, `eslint.config.js`, `package-lock.json`, `package.json`, `README.md`, `tsconfig.json`, `wrangler.jsonc`

Pre-existing cwd entries preserved untouched: `.cursor/`, `context/`, `.10x-cli.json`. The scaffold contained no `context/**` and no `.cursor/**` paths, so the drop rule for `context/` did not need to fire.

`npm install` stdout (tail):

```
added 648 packages, and audited 649 packages in 32s
232 packages are looking for funding
found 0 vulnerabilities
```

`npm install` stderr (warnings only, non-fatal):

```
npm warn install-scripts 3 packages have install scripts not yet covered by allowScripts:
npm warn install-scripts   esbuild@0.28.2 (postinstall: node install.js)
npm warn install-scripts   workerd@1.20260911.1 (postinstall: node install.js)
npm warn install-scripts   esbuild@0.28.1 (postinstall: node install.js)
npm warn install-scripts Run `npm install-scripts ls` to review, or `npm install-scripts approve <pkg>` to allow.
```

## Post-scaffold audit

**Tool**: `npm audit --json` (exit code 0)
**Summary**: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW
**Direct vs transitive**: 0/0/0/0 direct of total 0/0/0/0

Dependency tree at audit time: 804 total (377 prod, 269 dev, 167 optional).

#### CRITICAL findings

none

#### HIGH findings

none

#### MODERATE findings

none

#### LOW / INFO findings

none

## Hints recorded but not acted on

| Hint                    | Value                |
| ----------------------- | -------------------- |
| bootstrapper_confidence | first-class          |
| quality_override        | false                |
| path_taken              | standard             |
| self_check_answers      | null                 |
| team_size               | solo                 |
| deployment_target       | cloudflare-pages     |
| ci_provider             | github-actions       |
| ci_default_flow         | auto-deploy-on-merge |
| has_auth                | true                 |
| has_payments            | false                |
| has_realtime            | false                |
| has_ai                  | false                |
| has_background_jobs     | false                |

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:
- `git init` (if you have not already) to start your own repo history.
- Review any `.scaffold` siblings the conflict policy created and decide which version of each file to keep. (None were created in this run.)
- Address audit findings per your project's risk tolerance — the full breakdown is in this log. (Clean tree in this run.)
- Copy `.env.example` to `.env` and fill in the Supabase keys before running `npm run dev`.
