# Abuse & join identity test coverage — Plan Brief

> Full plan: `context/changes/testing-abuse-join-identity/plan.md`
> Research: `context/changes/testing-abuse-join-identity/research.md`

## What & Why

Phase 3 must prove outsiders cannot claim as another seat or act as MG on someone else’s session, and that anonymous callers cannot reach MG board content — at API authz and route-guard layer, not via full e2e login theater.

## Starting Point

The contract matrix and smoke cover anonymous and unknown-id negatives; the play-path suite covers happy-path claim/undo. Live forged claim with board unchanged, cross-code token reuse, cross-owner GM on a real session id, and live-id MG no-leak remain gaps. CI has only one provisioned GM.

## Desired End State

Dedicated `abuse-join-identity` integration suite, second CI GM + shared forge helpers, cookbook §6.6 filled, and test-plan Phase 3 marked done. Smoke stays single-GM.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Cross-owner GM proof | Second CI admin GM + live **404** on board/undo | Directly challenges “logged-in ⇒ any session” on a real row | Plan |
| Join abuse depth | Live forge + cross-code claim only | Write identity is claim-bound; stolen join token only adds a seat | Plan |
| #8 no-leak surfaces | Anon live GM board API + session page **302** (no follow) | API payload check plus SSR route guard without dashboard HTML scrape | Plan |
| Suite packaging | `abuse-join-identity.test.ts` + shared helpers in `http.ts` | §6.4 keeps matrix thin; one forge implementation | Plan |
| Closeout | §6.6 + Phase 3 done | Matches Phase 2 cookbook pattern | Plan |
| Test layer | Vitest preview HTTP | Same harness as play-path; no thin e2e | Research |

## Scope

**In scope:** second GM env + CI user; `resolveSecondTestCredentials` + `forgePlayerCookie`; abuse integration suite for #6/#8; §6.6 + Phase 3 status.

**Out of scope:** join-stolen-token case; code-only public board poll as bug; matrix abuse expansion; NFR guessing; RLS bypass; two-GM smoke; Playwright e2e; hosted db reset.

## Architecture / Approach

Owner GM creates live sessions; player clients use cookie jars and forged or cross-code cookies for claim negatives; second GM client hits owner session APIs; anon client hits live id board API and session page. Assert HTTP status plus follow-up player board GET where writes are denied.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Second GM + helpers | B creds, CI user, shared forge | Local dev without B pair skips cross-owner |
| 2. Abuse suite | Five live #6/#8 cases | Flaky or weak board-unchanged asserts |
| 3. Cookbook + status | §6.6 + Phase 3 done | Docs drift from actual env names |

**Prerequisites:** Phase 2 play-path helpers (`joinPlayer`, `createActiveSession`); local/CI Supabase + preview for integration.

**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- Local runs without `TEST_EMAIL_B` / `TEST_PASSWORD_B` skip cross-owner cases but CI always provides both.
- Wrong-owner denial stays **404**, not **403** — tests must match product contract.
- Valid active session code still allows public board poll without player cookie (by design).

## Success Criteria (Summary)

- Integration suite fails if live forged claim succeeds, cross-code claim occupies a cell, wrong GM reads/undoes, or anon live MG responses leak board content.
- CI provisions two GMs and greens the abuse file.
- §6.6 lets a contributor run the suite without re-reading research.
