<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Player join shared board

- **Plan**: context/changes/player-join-shared-board/plan.md
- **Scope**: Full plan
- **Reviewed phases**: 1, 2, 3, 4
- **Date**: 2026-10-03
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical 4 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING |
| Scope Discipline | PASS |
| Safety & Quality | WARNING |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Player nick uses text-player-N instead of bg-player-N

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/pages/play/[code].astro:12-28,147-148
- **Detail**: Plan contract: header nick on `bg-player-N` (and views use `bg-player-N` + `text-player-N-foreground`). Implementation maps colors to `text-player-N` only — no background swatch. Kitchen-sink mirrors the same drift.
- **Fix A ⭐ Recommended**: Use `bg-player-N text-player-N-foreground` (plus padding/radius) on the nick label to match the plan and token contract.
  - Strength: Restores the planned colored chip; tokens already exist for both roles.
  - Tradeoff: Visual change vs. current text-only label; need a quick visual check on kitchen-sink.
  - Confidence: HIGH — plan wording is explicit.
  - Blind spot: Contrast of all 16 fg/bg pairs on the paper card not re-audited here.
- **Fix B**: Document an intentional addendum that the nick is typography-colored only (no chip background).
  - Strength: Keeps current UI if preferred after manual testing.
  - Tradeoff: Plan remains wrong until amended; future agents may “fix” it back.
  - Confidence: MEDIUM — depends on product preference.
  - Blind spot: Whether GM/player visual parity was a hard requirement.
- **Decision**: FIXED via Fix B — plan addendum (typography-only nick color)

### F2 — Player cookie set without Secure flag

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/player-cookie.ts (write flags); src/pages/api/play/join.ts:53-58
- **Detail**: Cookie is httpOnly + SameSite=Lax + 400-day Max-Age but omits `Secure`. On any HTTP hop the cookie can be sent/set in cleartext. Production Workers are HTTPS; local HTTP would need a DEV exception.
- **Fix**: Set `secure: true` in production (e.g. when `import.meta.env.PROD` or request is HTTPS) on `cookies.set` / write helper flags.
- **Decision**: FIXED — secure: true when import.meta.env.PROD

### F3 — byCode cookie keys not validated against session code pattern

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/player-cookie.ts:72-77
- **Detail**: Parse ignores bad nick/color per entry but accepts arbitrary `byCode` keys. A crafted cookie can keep oversized keys; size trimming by `seen` cannot shrink a single huge key, so a rewrite may still emit a >3500-char Cookie value.
- **Fix**: Reject `byCode` keys that fail `SESSION_CODE_PATTERN` during parse (same ignore path as invalid nick/color).
- **Decision**: FIXED — reject byCode keys failing SESSION_CODE_PATTERN

### F4 — Cross-site POST can Set-Cookie a nick without CSRF defense

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/pages/api/play/join.ts:15-60
- **Detail**: SameSite=Lax blocks sending the cookie on cross-site POST, but does not block the response from setting a new cookie. An attacker page can POST a nick for a known code and overwrite the victim browser’s display identity. Impact is display-only today; blast radius grows when S-03 claims use this cookie.
- **Fix A ⭐ Recommended**: Require same-site `Origin`/`Referer` (or a CSRF/double-submit token) before writing the cookie.
  - Strength: Cheap boundary check; protects identity before claim lands.
  - Tradeoff: Must allow legitimate same-origin form posts; careful with missing Referer clients.
  - Confidence: HIGH — standard cookie CSRF pattern for cookie-setting POSTs.
  - Blind spot: Exact browser Referer policies on privacy-strict clients.
- **Fix B**: Defer CSRF hardening to S-03 with an explicit plan note that join remains CSRF-tolerant until claim.
  - Strength: Avoids scope creep in a closed slice if product accepts display-only risk.
  - Tradeoff: Leaves a known footgun until claim work; easy to forget.
  - Confidence: MEDIUM — only acceptable if S-03 is imminent and tracked.
  - Blind spot: Whether any intermediate deploy uses the cookie for anything else.
- **Decision**: SKIPPED — display-only nick/color for anonymous player not treated as sensitive; revisit if S-03 binds claims to this cookie

### F5 — JoinSessionForm not listed in UI-literal SCOPED_FILES

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: scripts/check-ui-literals.mjs; src/components/JoinSessionForm.tsx
- **Detail**: `JoinNickForm.tsx` is in `SCOPED_FILES`; the Phase 3 shared `JoinSessionForm.tsx` is not, while Welcome (which embeds it) is. Justified EXTRA for the loader lesson, but scan coverage is inconsistent.
- **Fix**: Add `src/components/JoinSessionForm.tsx` to `SCOPED_FILES`.
- **Decision**: FIXED — added to SCOPED_FILES

### F6 — Nick input lacks maxLength=24

- **Severity**: 💬 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/components/play/JoinNickForm.tsx:32
- **Detail**: Server/schema enforce 1–24 after trim; the input has no `maxLength={24}`, so users only learn the limit after a failed round-trip.
- **Fix**: Add `maxLength={24}` on the nick input.
- **Decision**: FIXED — maxLength={24} on nick Input
