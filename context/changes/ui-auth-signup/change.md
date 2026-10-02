---
change_id: ui-auth-signup
title: Audyt i poprawa widoku rejestracji
status: implementing
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Notes

Audyt i poprawa widoku rejestracji (`/10x-ui`).

- **View:** `/auth/signup` — `src/pages/auth/signup.astro` + `src/components/auth/SignUpForm.tsx`
- **Motif / token source:** existing Vintage Paper dark theme via the shadcn contract already in the repo (`src/styles/global.css` `:root` / `.dark` → `@theme inline`). Do not fork a second palette or re-run `shadcn init`. Sign-in (`ui-auth-signin`) already reads these tokens. Shared primitives `FormField.tsx`, `SubmitButton.tsx`, `PasswordToggle.tsx`, and `ServerError.tsx` are already in `scripts/check-ui-literals.mjs` `SCOPED_FILES`. The signup page and `SignUpForm.tsx` are not.
- **Poza tym widokiem:** `/auth/confirm-email` still uses the cosmic card. It is not a second view of this change.

Pre-audit (2026-10-02), hardcoded-value scan on the view files:

- `src/pages/auth/signup.astro` — 7 palette hits (`border-white`, `bg-white`, `text-white`, `from-blue-200`, `to-purple-200`, `text-blue-100`, `text-purple-300`) plus `bg-cosmic` (banned by the repo check, outside the skill regex)
- `src/components/auth/SignUpForm.tsx` — 1 hit (`text-blue-100/50` on the password-length hint)
- Shared auth primitives — 0 hits

Contract variant: existing design system. The work is to make this view read the tokens sign-in already uses.
