<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: GM Undo Field Claim

- **Plan**: context/changes/gm-undo-field-claim/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-03
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — undoBoardCell re-selects after RPC and forces claimedByColor null

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/lib/services/sessions.service.ts:369-403
- **Detail**: Plan asked for mapping RPC result to a GM cell DTO. Implementation discards the RPC return set (which omits board_cells identity fields), re-SELECTs under GM RLS, then hardcodes `claimedByColor: null`. Contract is met for the UI (`GmBoard` keys claimed state off `claimedByColor`), and a reclaim race in the re-select window self-corrects on the next poll. Differs from `claimBoardCell`, which maps RPC rows directly.
- **Fix**: Prefer mapping the RPC free-cell row into the DTO (extend RPC returns with needed identity fields, or keep re-select but derive `claimedByColor` from the row without forcing null). Optional — current behavior is correct for the planned UX.
- **Decision**: FIXED — map RPC claimed_by_color/reward into DTO; null claim columns to match undo snapshot

### F2 — Review-time build blocked by env (dist lock + Node 26)

- **Severity**: OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: N/A
- **Detail**: Re-ran automated gates in this review: `npm run lint` PASS; `npx astro check` PASS (0 errors). `npm run build` FAILED because `dist/` is locked by an active `npm run dev` process and the shell is on Node v26.9.0 (`.nvmrc` is 22.14.0) — Astro `emptyDir` hits `rmdirSync({ recursive })` which Node 26 rejects. Progress stamped 4.2/4.3 as done at `951eada`. Smoke not re-run here. Manual Progress rows are supported by kitchen-sink fixtures and live terminal evidence of `POST …/undo-claim` 200 during a claim→undo session.
- **Fix**: Re-run `npm run build` / `npm run smoke` under Node 22 with `dist` unlocked when convenient; no product change required for this finding.
- **Decision**: FIXED — kept Node 26; stopped preview locking `dist`; `npm run build` PASS
