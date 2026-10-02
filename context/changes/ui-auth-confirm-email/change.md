---
change_id: ui-auth-confirm-email
title: Audyt i poprawa widoku potwierdzenia e-mail
status: implemented
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Notes

Audyt i poprawa widoku potwierdzenia e-mail (`/10x-ui`).

- **View:** `/auth/confirm-email` — `src/pages/auth/confirm-email.astro` (static Astro page; no React island)
- **Motif / token source:** existing Vintage Paper dark theme via the shadcn contract already in the repo (`src/styles/global.css` `:root` / `.dark` → `@theme inline`). Do not fork a second palette or re-run `shadcn init`. Sign-in (`ui-auth-signin`) and sign-up (`ui-auth-signup`) already read these tokens. Shared primitives live in `src/components/ui` and `src/components/auth/`. This page is not in `scripts/check-ui-literals.mjs` `SCOPED_FILES`.

Pre-audit (2026-10-02), hardcoded-value scan on the view file:

- `src/pages/auth/confirm-email.astro` — 7 palette hits (`border-white`, `bg-white`, `text-white`, `from-blue-200`, `to-purple-200`, `text-blue-100`, `text-purple-300`) plus `bg-cosmic` (banned by the repo check, outside the skill regex)
- No hex, `rgb`/`hsl`/`oklch`, or arbitrary `px`/`rem` values

Contract variant: existing design system. The work is to make this one view read the tokens sign-in and sign-up already use.
