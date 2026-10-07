---
change_id: testing-runner-bootstrap-board-integrity
title: Runner bootstrap + board integrity
status: archived
created: 2026-10-06
updated: 2026-10-07
archived_at: 2026-10-07T11:37:25Z
---

## Notes

Open a change folder for rollout Phase 1 of context/foundation/test-plan.md: "Runner bootstrap + board integrity".
Risks covered: #1 (invalid/incomplete board on create), #2 (API failure treated as HTTP success). Test types planned: runner setup, integration, contract.
Risk response intent:

- #1: prove create-session never persists a board with wrong cell count, empty phrase, or unknown reward id; challenge "Generate returned OK => board is playable"; avoid asserting only HTTP 200 or mirroring generator internals.
- #2: prove non-success paths use non-2xx (or an error body the client treats as failure) so the client does not advance on error; challenge "Any JSON body means success"; avoid happy-path-only and full-body snapshots.
  After creating the folder, follow the downstream continuation rule.

Known gap / deferred (out of product fix scope for this change): `createSession` is non-atomic (session insert then `board_cells` insert). If cell insert fails after the session row is written, the API returns **500** and the client does not advance, but a **0-cell orphan session** can remain. No red test and no transactional rewrite in this change; cookbook §6 may restate this in Phase 4.
