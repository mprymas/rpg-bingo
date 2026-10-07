# Play-path claim & undo test coverage — Plan Brief

> Full plan: `context/changes/testing-play-path-claim-undo/plan.md`
> Research: `context/changes/testing-play-path-claim-undo/research.md`

## What & Why

Protect the live play path against concurrent double-claims, missing reward reveal, stuck state after refresh/rejoin, and undo that only looks free. Phase 2 of the test plan needs integration proof — not kitchen-sink or sequential smoke alone.

## Starting Point

Claim/undo are RPC-authoritative; smoke covers sequential conflict; Vitest has create-board + failure-matrix helpers but no happy-path claim/undo, no `joinPlayer`, and no catalog `rewardId` fixture. Seed reward ids are random; CI may not guarantee seed before integration.

## Desired End State

Preview-HTTP Vitest cases prove Risks #3/#4/#5/#7; helpers join and bootstrap sessions; tests pick rewards by slug against fixed seed ids; CI seeds local Supabase; cookbook §6.5 is filled and Phase 2 is done.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Test layer | Vitest integration; no thin e2e | Research: cookie/SSR recovery makes browser e2e unnecessary for #4/#5 | Research |
| Reward fixture | Fixed seed UUIDs; tests use slug → id | Stable create-with-rewards without HTML scrape; slug is the human handle | Plan |
| Helpers | `joinPlayer` + `createActiveSession` in `http.ts` | Shared join/create; keep oracles in the test file | Plan |
| Race aggressiveness | One `Promise.all` pair | Matches risk; avoids flaky retry loops | Plan |
| Undo coverage | Reclaim in same case | Proves cell is claimable after undo, not only visually free | Plan |
| CI catalog | Seed after `supabase start` | Risk #4 must green in CI, not only locally | Plan |

## Scope

**In scope:** seed fixed reward ids; slug→id helper; CI local seed; http helpers; integration suite for #3/#4/#5/#7; cookbook §6.5 + Phase 2 status.

**Out of scope:** Playwright e2e; kitchen-sink/pixels; sequential-only as race proof; Phase 3 abuse; deleting `reward_id` on undo; rewards REST API; hosted db reset.

## Architecture / Approach

GM signs in → create session (optional catalog reward by slug) → one or two player cookie jars join → claim/undo/board over HTTP → assert status + follow-up snapshots. Parallelism only for the dual-client race case.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Catalog fixture + CI seed | Fixed ids, slug map, CI seed | Local DB still on old random ids until reset |
| 2. Play-path helpers | `joinPlayer` + session bootstrap | Helpers too thin/thick vs cookbook |
| 3. Integration suite | Risks #3/#4/#5/#7 cases | Flaky race or empty catalog in CI |
| 4. Cookbook + status | §6.5 filled; Phase 2 done | Docs drift from actual helpers |

**Prerequisites:** Phase 1 runner/integration harness (`testing-runner-bootstrap-board-integrity`); local/CI Supabase + preview for integration.
**Estimated effort:** ~1–2 sessions across 4 phases.

## Open Risks & Assumptions

- Existing local DBs keep random reward ids until a local-only reset matches the slug map.
- `npx supabase seed` (or chosen equivalent) is available in the CI CLI version after start.
- One parallel claim pair is enough to exercise row-level first-wins without retries.

## Success Criteria (Summary)

- Integration suite fails on double-owner race, missing reveal, stuck rejoin, or undo that leaves ownership/mystery wrong.
- CI runs the suite against a seeded catalog.
- Contributors can copy §6.5 without re-reading research.
