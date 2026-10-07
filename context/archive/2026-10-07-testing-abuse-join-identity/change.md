---
change_id: testing-abuse-join-identity
title: Abuse & join identity test coverage
status: archived
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07T11:37:25Z
---

## Notes

Open a change folder for rollout Phase 3 of context/foundation/test-plan.md: "Abuse & join identity".
Risks covered: #6 (outsider with guessed/leaked code or forged player identity joins or claims on someone else's session), #8 (unauthenticated user reaches MG-protected surfaces — create board, board list, board preview as MG — and sees or acts as MG). Test types planned: API authz / integration, route-guard.
Risk response intent:

- #6: prove claim/undo require valid session player (or MG) identity and invalid code cannot see board; challenge "Logged-in ⇒ can touch any session"; avoid full e2e login theater.
- #8: prove unauthenticated request to MG create / list / board-preview surfaces is denied (redirect or 401/403) with no protected board content; challenge "Auth-flow smoke ⇒ every MG-protected route is closed"; avoid full e2e login theater and kitchen-sink only.
  After creating the folder, follow the downstream continuation rule.
