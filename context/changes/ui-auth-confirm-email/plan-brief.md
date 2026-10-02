# Confirm-email Vintage Paper — Plan Brief

> Full plan: `context/changes/ui-auth-confirm-email/plan.md`
> Research: `context/changes/ui-auth-confirm-email/research.md`

## What & Why

After a successful signup the person leaves the paper registration card and lands on a blue-purple glass panel. This change makes `/auth/confirm-email` read the Vintage Paper tokens sign-in and sign-up already use, keeps only the inbox sentence, and sends a visitor who already has a session to `/dashboard`.

## Starting Point

`src/pages/auth/confirm-email.astro` is one static page. It switches copy with `import.meta.env.DEV`, does not read `Astro.locals.user`, and is outside `SCOPED_FILES`. There is no kitchen sink. `POST /api/auth/signup` still redirects here on success.

## Desired End State

A logged-out visitor sees a paper card: „Sprawdź swoją skrzynkę”, the confirmation-link body, and „Wróć do logowania” with a visible focus ring. A signed-in visit, including a local signup that already wrote a session, continues to `/dashboard`. Dev `/auth/confirm-email/kitchen-sink` shows that card plus hover/focus, and marks the other four states N/A. Lint fails if palette classes or `bg-cosmic` return.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Live sentence | Inbox only: „Sprawdź swoją skrzynkę” | The DEV flag is not `enable_confirmations`, and the ready sentence leaves the product. | Plan |
| Signed-in visit | Redirect to `/dashboard` in the page frontmatter | Same entry as sign-in and sign-up, without a middleware prefix that would also hide the sink. | Plan |
| Signup success URL | Still `/auth/confirm-email` | The page redirect handles a session that is already set; `signup.ts` stays unchanged. | Plan |
| Shell | Inline `div` with sign-in role classes; no emoji, no gradient | There is no `card.tsx`; sign-in and sign-up already use this markup. | Research |
| Sink states | Default and hover/focus shown; disabled, error, empty, loading N/A | Those four do not exist on this static page, and the ready copy is not a live state. | Research / Plan |
| Focus ring | This change’s links only, `focus-visible:ring-2 focus-visible:ring-ring` | Sibling footer links omit it; `ring-[3px]` would fail the literal scan. | Research |
| Guard | Both confirm-email files in `SCOPED_FILES`; not `input.tsx` or `button.tsx` | C4; shared primitives stay outside the guard, as on sign-up. | Research |

## Scope

**In scope:**

- Relocate to `src/pages/auth/confirm-email/index.astro` (URL unchanged)
- Role-class card, inbox sentence only, signed-in redirect
- Dev kitchen sink, screenshots, `SCOPED_FILES`, agent-rule pointers

**Out of scope:**

- Token redeposit, removing `bg-cosmic`, restyling Welcome / sign-in / sign-up
- shadcn `Card`, signup POST destination, confirmation-callback route
- „Rejestracja zakończona”, hosted `enable_confirmations`, Playwright

## Architecture / Approach

One static Astro page. Phase 1 copies the sign-in shell and deletes the DEV copy switch. A session cookie, when `setAll` wrote one, is already on the next request, so the frontmatter redirect runs before the card. The sink is a second file under the same route directory and does not apply that redirect.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. One view + signed-in entry | Paper card, inbox sentence, dashboard redirect | Leaving the flat `confirm-email.astro` in place blocks the sink route |
| 2. Kitchen-sink + visual gate | Default, hover/focus, four N/A labels, two screenshots | A forced ring class that drifts from the live `focus-visible` link |
| 3. Guard | `SCOPED_FILES` plus both agent-rule files | Omitting the sink file lets palette classes return there |

**Prerequisites:** Sign-in and sign-up already read the Vintage Paper tokens. No new dependency.
**Estimated effort:** ~1–2 sessions across 3 phases.

## Open Risks & Assumptions

- A local signup session is inferred from `enable_confirmations = false` and `setAll`, not from an observed response. If the cookie is absent, the visitor sees the inbox card after signup; the redirect still runs only when `Astro.locals.user` is set.
- Hosted `enable_confirmations` is not in the repo. When it is on, the inbox sentence is the screen they should see. When it is off, they are redirected and never read it.

## Success Criteria (Summary)

- A logged-out visitor sees the paper inbox card and a focus ring on the sign-in link.
- A signed-in visitor, including after a local signup that wrote a session, reaches `/dashboard`.
- The kitchen sink and `npm run lint` cover this page, and the ready-copy strings are gone.
