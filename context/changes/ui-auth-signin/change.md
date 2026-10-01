---
change_id: ui-auth-signin
title: Audyt i poprawa widoku logowania
status: impl_reviewed
created: 2026-10-01
updated: 2026-10-01
archived_at: null
---

## Notes

Audyt i poprawa widoku logowania (`/10x-ui`).

- **View:** `/auth/signin` — `src/pages/auth/signin.astro` + `src/components/auth/SignInForm.tsx` (wspólne prymitywy: `FormField.tsx`, `SubmitButton.tsx`, `PasswordToggle.tsx`, `ServerError.tsx`)
- **Motif / token source:** existing Vintage Paper dark theme via shadcn contract already in repo (`src/styles/global.css` `:root` / `.dark` → `@theme inline`); do not fork a second palette or re-run `shadcn init`. Extend the guard from earlier UI changes (CLAUDE.md § UI / design tokens, `scripts/check-ui-literals.mjs` SCOPED_FILES).
- **Poza tym widokiem:** `/auth/signup` i `/auth/confirm-email` kopiują tę samą kartę (`bg-cosmic` + paleta). Nie są drugim widokiem tej zmiany; research może je oznaczyć jako deferred albo jako skutek wspólnego prymitywu, jeśli sign-in go wydzieli.
