<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Vintage Paper create-session board

- **Plan**: context/changes/ui-new-session-board/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-09-30
- **Verdict**: APPROVED
- **Findings**: 0 critical 2 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Catalog error path returns HTTP 200

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/sessions/new/index.astro:16-32
- **Detail**: C4 correctly renders Layout + Polish error instead of a bare Response body, but the response status stays 200. Sibling hard-failure pages (`dashboard`, `sessions/[id]`) use non-2xx Responses. Monitors/CDNs treat this as success. Plan required Layout error UI, not a specific status code.
- **Fix A ⭐ Recommended**: Keep the Layout error UI and set `Astro.response.status = 503` (or 500) before render so the branded body stays while status signals failure.
  - Strength: Matches C4 UX intent and sibling non-2xx failure signaling.
  - Tradeoff: One-line Astro status change; need a quick manual check of the error path.
  - Confidence: HIGH — Astro supports `Astro.response.status` on SSR pages.
  - Blind spot: Haven't verified Cloudflare/workerd status passthrough for this page specifically.
- **Fix B**: Leave HTTP 200 and document that catalog-load soft-fail is intentional UX.
  - Strength: Zero code change; matches what shipped.
  - Tradeoff: Ops/monitoring blind spot remains.
  - Confidence: MEDIUM — depends whether anyone alerts on `/sessions/new` status.
  - Blind spot: No monitoring config reviewed.
- **Decision**: FIXED via Fix A + ACCEPTED-AS-RULE: Prefer non-2xx status with branded Layout error UI

### F2 — Unrelated migration CRLF bundled in Phase 1 commit

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: supabase/migrations/20260927134220_phrases_and_rewards.sql
- **Detail**: `ba989f5` includes a CRLF-only normalize of an existing migration with no schema intent. Not in plan Changes Required. No NOT-Doing product-rule violation, but pollutes the change's commit surface.
- **Fix**: Leave as-is (already landed); avoid bundling unrelated line-ending noise in future phase commits.
- **Decision**: FIXED (leave as-is; process note for future commits)

### F3 — Uncommitted UI-guard extras beyond plan

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: CLAUDE.md, AGENTS.md, scripts/check-ui-literals.mjs, package.json (`lint` script)
- **Detail**: Working tree has uncommitted guard work (hard-rule docs + `check-ui-literals.mjs` wired into `npm run lint`) referenced in `change.md` Notes but not in plan Changes Required. Current `npm run lint` fails prettier on the new script; scoped eslint of plan files and `npx astro check` pass. Phase commits themselves passed lint at land time.
- **Fix A ⭐ Recommended**: Finish and land the guard as a follow-up commit/change (fix prettier, then commit), or drop it from the working tree before archive.
  - Strength: Keeps lint green and documents the token contract as intended by change Notes.
  - Tradeoff: Extra commit outside the four plan phases.
  - Confidence: HIGH — files already drafted in the tree.
  - Blind spot: Exact intended scope of the literals scanner not reviewed in depth.
- **Fix B**: Revert uncommitted guard files so `lint` matches the implemented plan surface.
  - Strength: Restores green `npm run lint` immediately.
  - Tradeoff: Loses the guard drafting work.
  - Confidence: HIGH.
  - Blind spot: Whether the user wants the guard for archive readiness.
- **Decision**: FIXED via Fix A (landed UI guard + lint scanner)

### F4 — Client phrase rows unbounded vs API max(50)

- **Severity**: 🔍 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/components/sessions/NewSessionForm.tsx:174
- **Detail**: “Dodaj hasło” has no client cap; API schema allows `customPhrases.max(50)`. Empty rows can grow the DOM before submit. Pre-existing behavior pattern; not introduced as a product-rule change, but restyle left the gap.
- **Fix**: Disable “Dodaj hasło” when `customPhrases.length >= 50` to match the API schema.
- **Decision**: PENDING
