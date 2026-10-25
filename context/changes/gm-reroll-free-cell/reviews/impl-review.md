<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: GM Reroll Free Cell

- **Plan**: context/changes/gm-reroll-free-cell/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1
- **Date**: 2026-10-25
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 1 observation

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Automated checks

- `npm run test:unit` — PASS (103 tests)
- `npm run lint` — PASS
- `npx astro check` — PASS (0 errors)
- `npm run test:integration -- --testTimeout 30000` — PASS (55 tests). The default 5s timeout timed out against the hosted project, including older suites; the same command with a 30s timeout passed, including `tests/integration/reroll-phrase.test.ts`.

Manual Progress rows 1.5–1.10 are `[x]` after the user confirmed the session flow and the kitchen-sink edit chrome.

## Findings

### F1 — Normalized-duplicate test uses the exact visible phrase

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: tests/integration/reroll-phrase.test.ts:208
- **Detail**: The plan's commit check rejects a board that collides after trim, collapsed whitespace, and lower case, because `UNIQUE (session_id, phrase)` only compares exact text. The test named `rejects a normalized duplicate and writes nothing` sends cell 0's exact `phrase` onto cell 1. That is also an exact duplicate, so a passing 409 does not show that a whitespace variant of a phrase still on the board is rejected.
- **Fix**: Create the session with a visible phrase that is the catalog text plus surrounding whitespace, then commit the exact catalog text onto another cell and expect 409 with no phrase change.
  - Strength: That pair is what the unique index allows and the SQL normalize check must reject.
  - Tradeoff: The fixture has to survive create-time trimming; if create already stores the trimmed catalog text, the case cannot be set up through the public API.
  - Confidence: MEDIUM — the SQL check is in place; the test gap is real; create-time normalization was not re-checked in this review.
  - Blind spot: Have not confirmed whether custom phrase input is stored with its original whitespace.
- **Decision**: FIXED

### F2 — Edit chrome is an X and a check, plus a hint

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/components/sessions/GmBoard.tsx:528
- **Detail**: The plan described text buttons Anuluj and Zatwierdź on the board. After review, edit mode hides the pencil and puts an X (`aria-label="Anuluj"`) and a check (`aria-label="Zatwierdź"`) in that header slot. The board shows "Kliknięcie w wolne pole wylosuje nowe hasło." The user asked for this after the plan was written, and the publish, cancel, disabled-when-empty, and loader behavior still match the plan.
- **Fix**: Leave the chrome. The plan's button labels are now the accessible names, not visible text.
- **Decision**: FIXED (no code change; chrome left as requested)
