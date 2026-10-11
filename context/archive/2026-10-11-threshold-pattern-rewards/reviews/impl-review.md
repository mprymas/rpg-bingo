<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Threshold & Row/Column Rewards

- **Plan**: context/changes/threshold-pattern-rewards/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-11
- **Verdict**: REJECTED
- **Findings**: 2 critical 4 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | FAIL |
| Scope Discipline | FAIL |
| Safety & Quality | WARNING |
| Architecture | WARNING |
| Pattern Consistency | WARNING |
| Success Criteria | WARNING |

## Findings

### F1 — Board-edge line reward markers violate NOT-doing

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Scope Discipline
- **Location**: src/components/play/BoardWithLineSlots.tsx; supabase/migrations/20261011173000_player_reward_inputs_line_slots.sql; commit 457c9b1
- **Detail**: Plan §What We're NOT Doing explicitly forbids "showing line-reward markers on the board edges." Commit `457c9b1` ("board-edge line rewards…") adds `BoardWithLineSlots`, `line-slots.ts`, RPC `line_slots`, and CSS utilities. Mystery gating in the RPC is solid, but the feature itself is out of scope. Plan body was not amended — only Progress checkboxes were stamped.
- **Fix A ⭐ Recommended**: Treat the edge UI as accepted scope — add a plan addendum that removes the edge ban, documents `lineSlots` / `BoardWithLineSlots` / follow-up migrations, and retargets Phase 4.4–4.6 success criteria to the new UI.
  - Strength: Matches what shipped and was manually walked (Progress 4.7–4.10 stamped on the same commit); avoids throwing away a coherent UX.
  - Tradeoff: Plan becomes a moving target; original reviewers of scope are not automatically notified.
  - Confidence: HIGH — the code, migrations, kitchen sinks, and integration cases already center on edges.
  - Blind spot: Product intent for "NOT doing" may still stand if the ban was deliberate for MVP focus.
- **Fix B**: Revert board-edge UI + `line_slots` migration/API props; restore the planned under-board earned list.
  - Strength: Restores strict plan adherence and the original scope boundary.
  - Tradeoff: Large delete/rewrite; loses UX already validated manually.
  - Confidence: MEDIUM — depends whether players already rely on edges in playtesting.
  - Blind spot: Whether hosted Supabase already applied the follow-up migrations.
- **Decision**: Fixed via Fix A

### F2 — Player board shows other players' earned threshold rewards

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Scope Discipline
- **Location**: src/components/play/PlayerRosterList.tsx:117-165; src/components/play/PlayerBoard.tsx:494-504; supabase/migrations/20261011180000_session_players_threshold_roster.sql
- **Detail**: Plan forbids "Showing other players' earned rewards on the player board." `PlayerRosterList` on the player board reveals every player's earned threshold label (and X/N progress). RPC `get_session_players_by_code` was extended to return earned threshold slug/label. GM roster visibility was in-scope; peer visibility on the player board was not.
- **Fix A ⭐ Recommended**: Keep shared roster progress bars (X/N) for table energy, but hide peer reward *labels* on the player path (`revealAssigned` already exists for GM) — only show the local player's earned label (or keep mystery tiles for others).
  - Strength: Preserves most of the new roster UX while restoring the privacy/scope guardrail for reward types.
  - Tradeoff: Partial redesign; peers still see progress fractions.
  - Confidence: HIGH — `revealAssigned` / mystery tile plumbing already exists.
  - Blind spot: Whether seeing peers' labels was an intentional table-side design choice during manual testing.
- **Fix B**: Document peer threshold visibility as an accepted addendum and update the NOT-doing list.
  - Strength: Zero code churn if the product wants open table info.
  - Tradeoff: Leaves the original constraint violated on paper until the plan is rewritten.
  - Confidence: MEDIUM — depends on product preference.
  - Blind spot: Whether line rewards for others are also exposed elsewhere (edges only reveal completed lines).
- **Decision**: Fixed via Fix B

### F3 — Planned "Twoje nagrody" / "Zdobyte pola" panel removed

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/components/play/PlayerBoard.tsx:433-504; plan.md Phase 4.4 (~L299-305)
- **Detail**: Phase 4.4 required under-board "Zdobyte pola: X/N" and "Twoje nagrody" listing threshold + line rewards. That panel existed in `d55a189` and was removed in `457c9b1`, replaced by edge slots + roster. Desired End State and Phase 4.4 contract still describe the old panel. No planned item is fully MISSING without replacement — presentation was swapped.
- **Fix A ⭐ Recommended**: Update Phase 4.4 / Desired End State in the plan to describe roster + edge slots as the canonical UI (pair with F1/F2 decisions).
  - Strength: Aligns source of truth with shipped code before archive.
  - Tradeoff: Retcon of the original UI contract.
  - Confidence: HIGH — kitchen sinks and integration already follow the new UI.
  - Blind spot: None significant if F1/F2 are also accepted.
- **Fix B**: Restore the planned panel (optionally alongside edges).
  - Strength: Literal plan match for Phase 4.4.
  - Tradeoff: Duplicate progress surfaces; clutter on small viewports.
  - Confidence: MEDIUM — may fight the edge/roster composition.
  - Blind spot: Manual phone-width kitchen-sink gate may fail with both UIs.
- **Decision**: Fixed via Fix A (covered by F1 plan addendum; no further edit)

### F4 — Claim success clears progress when snapshot fails

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/play/claim.ts:65-83; src/components/play/PlayerBoard.tsx:354-357
- **Detail**: API correctly keeps claim 200 and sets `progress: null` / `lineSlots: []` after `reportError` (plan contract). Client always applies those fields, so a transient progress RPC failure after a successful claim wipes prior progress and edge mystery UI until the next ~5s poll.
- **Fix**: On claim success, only call `setProgress` / `setLineSlots` when the snapshot succeeded (e.g. omit keys on failure, or skip client updates when `progress === null` and previous state was non-null for a rules session).
- **Decision**: FIXED — omit progress/lineSlots on snapshot failure; client updates only when keys are present

### F5 — Unbounded lineRewardIds / thresholdRewardIds arrays

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/lib/schemas/session.ts:28-39
- **Detail**: `customPhrases` is capped with `.max(50)`; the new reward-id arrays only enforce uniqueness. A large unique-UUID payload forces validation + catalog lookup before `UNKNOWN_REWARD`. UI won't hit this; the API boundary will.
- **Fix**: Add `.max(N)` aligned with catalog size (or a small hard cap, e.g. 32) on both arrays.
- **Decision**: FIXED — `.max(32)` on lineRewardIds and thresholdRewardIds

### F6 — field_rewards pipeline makes rule-less progress non-null

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Scope Discipline
- **Location**: supabase/migrations/20261011172000_player_reward_inputs_field_rewards.sql; tests/integration/threshold-pattern-rewards.test.ts (~rule-less case); plan Desired End State / Phase 4.1
- **Detail**: Unplanned `field_rewards` in the player RPC folds per-field Pole rewards into `progress`. Sessions with no threshold/line rules can return non-null `progress` after a field claim, contradicting "progress null = no identity or session without rules" and manual 4.9 ("no progress section shown" for pre-change sessions — roster/threshold UI may stay hidden, but the DTO contract drifted).
- **Fix A ⭐ Recommended**: Document `fieldRewards` as an intentional extension of the earned list / roster story and update the null-progress contract in the plan + types comments.
  - Strength: Keeps useful Pole visibility in the new UI model.
  - Tradeoff: Widens "rules" semantics beyond S-02 threshold/line scope.
  - Confidence: MEDIUM — integration already expects fieldRewards on rule-less claim.
  - Blind spot: Whether old sessions show any new UI chrome solely from field rewards.
- **Fix B**: Stop treating field rewards as "has rules"; keep `progress` null when threshold/line rules are off, and surface Pole only via the existing cell reveal.
  - Strength: Restores the planned null-progress contract for rule-less sessions.
  - Tradeoff: Loses consolidated earned listing for Pole.
  - Confidence: HIGH for plan match.
  - Blind spot: Call sites that already branch on `fieldRewards`.
- **Decision**: Fixed via Fix B

### F7 — Manual Progress stamped on drift commit without plan addendum

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: context/changes/threshold-pattern-rewards/plan.md Progress (1.5, 2.4, 3.6–3.8, 4.7–4.10) — sha 457c9b1
- **Detail**: Manual rows were flipped `[x]` in the same commit that introduced board edges and roster redesign. Diff evidence shows UI/kitchen-sink work, so this is not empty rubber-stamping — but the criteria text still describes the pre-drift UI ("Twoje nagrody", "no progress section"), so the stamps validate a different product than the written criteria.
- **Fix**: After F1–F3 decisions, either rewrite the manual criteria to match the shipped UI or re-run manuals against restored plan UI.
- **Decision**: FIXED — accepted F1 Phase 4 Success Criteria rewrite; Progress titles left immutable

### F8 — Integration and smoke not re-verified in this review

- **Severity**: ⚪ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: N/A
- **Detail**: Initially only unit/lint/astro check/build were re-run here. Integration uses linked Supabase + preview (not local Docker). Progress had claimed green on `d55a189`.
- **Fix**: Re-run integration (+ smoke if desired) against preview + linked Supabase.
- **Decision**: FIXED — rebuilt preview; `PREVIEW_BASE_URL=http://localhost:4321 npm run test:integration` → 9 files / 47 tests passed. Smoke not re-run (out of requested scope).
