---
change_id: testing-play-path-claim-undo
title: Play-path claim & undo test coverage
status: implementing
created: 2026-10-07
updated: 2026-10-07
archived_at: null
---

## Notes

Open a change folder for rollout Phase 2 of context/foundation/test-plan.md: "Play-path claim & undo".
Risks covered: #3 (concurrent claim race — both believe they own the cell), #4 (board view / claim path so player cannot mark free cell or see reward), #5 (stale client/persisted data stuck until cache clear), #7 (MG undo frees cell visually but leaves reward/ownership intact). Test types planned: integration (+ optional thin e2e if research requires UI).
Risk response intent:
- #3: prove second concurrent claim loses, only one owner, loser sees occupied-by; challenge "sequential tests prove race safety"; avoid single-threaded double-click simulation only.
- #4: prove free cell claim updates ownership + shows reward and refresh still shows claim; challenge "rendering the grid proves claim works"; avoid kitchen-sink / pixel snapshots.
- #5: prove after refresh/rejoin with valid cookie/code the app recovers without manual cache clear; challenge "localStorage wipe is an acceptable fix"; avoid brittle timing e2e.
- #7: prove after undo cell is free, previous reward invalidated, other players' view consistent; challenge "undo only clears the cell label"; avoid UI-only undo click without DB assert.
After creating the folder, follow the downstream continuation rule.
