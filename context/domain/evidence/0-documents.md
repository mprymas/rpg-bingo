# Sources: documents

- documents: 2 requirements, 25 narrative (sample in the docs-language pass), 5 reference, 8 engineering

Product name in the requirements frontmatter: RPG Bingo. README at the repository root describes the starter template, not the product.

## Domain documents

| path | kind | what it is about |
| --- | --- | --- |
| `context/foundation/prd.md` | requirements | Product requirements, version 1, created 2026-09-18, status draft, greenfield. Vision, personas, success criteria, stories, functional requirements, business logic, access, non-goals. |
| `context/foundation/prd-v2.md` | requirements | Brownfield requirements, version 2, created 2026-10-11, status draft. Restates a one-sentence product goal, then the delta after a real play session. |
| `context/foundation/shape-notes.md` | narrative | Shaping notes dated 2026-10-11 that fed prd-v2. Checkpoint decisions in frontmatter. |
| `context/foundation/archive/shape-notes-2026-10-11-1304.md` | narrative | Earlier shaping notes (greenfield vision) archived the same day. Superseded by the current shape notes and by prd.md. |
| `context/foundation/roadmap.md` | narrative | Milestone roadmap, updated 2026-10-14, derived from prd-v2. Slice status table. |
| `context/archive/2026-10-14-gm-tile-reward-typography/` | narrative | Archived change: change.md, plan-brief.md, plan.md. |
| `context/archive/2026-10-11-threshold-pattern-rewards/` | narrative | Archived change: change.md, plan-brief.md, plan.md, reviews/impl-review.md. |
| `context/archive/2026-10-11-player-join-via-qr/` | narrative | Archived change: change.md, plan-brief.md, plan.md, reviews/impl-review.md. |
| `context/archive/2026-10-11-gm-regenerate-board/` | narrative | Archived change: change.md, plan-brief.md, plan.md, reviews/impl-review.md. |
| `context/archive/2026-10-11-gm-delete-session/` | narrative | Archived change: change.md, plan-brief.md, plan.md, reviews/impl-review.md. |
| `context/archive/2026-10-07-testing-play-path-claim-undo/` | narrative | Archived change (tests): change.md, plan-brief.md, plan.md, research.md. |
| `context/archive/2026-10-07-testing-abuse-join-identity/` | narrative | Archived change (tests): change.md, plan-brief.md, plan.md, research.md. |
| `context/archive/2026-10-07-report-error-helper/` | narrative | Archived change: change.md, plan-brief.md, plan.md, research.md. |
| `context/archive/2026-10-07-configure-sentry/` | narrative | Archived change: change.md, plan-brief.md, plan.md. |
| `context/archive/2026-10-06-testing-runner-bootstrap-board-integrity/` | narrative | Archived change (tests): change.md, plan-brief.md, plan.md, research.md. |
| `context/archive/2026-10-03-player-join-shared-board/` | narrative | Archived change: change.md, plan-brief.md, plan.md, research.md, reviews/impl-review.md, follow-ups/review-fixes.md. |
| `context/archive/2026-10-03-player-claim-field-reward/` | narrative | Archived change: change.md, plan-brief.md, plan.md, reviews/impl-review.md. |
| `context/archive/2026-10-03-gm-undo-field-claim/` | narrative | Archived change: change.md, plan-brief.md, plan.md, reviews/impl-review.md. |
| `context/archive/2026-10-02-ui-auth-signup/` | narrative | Archived UI change: change.md, plan-brief.md, plan.md, research.md, reviews/impl-review.md. |
| `context/archive/2026-10-02-ui-auth-confirm-email/` | narrative | Archived UI change: change.md, plan-brief.md, plan.md, research.md, reviews/impl-review.md. |
| `context/archive/2026-10-01-ui-session-board/` | narrative | Archived UI change: change.md, plan-brief.md, plan.md, research.md, reviews/impl-review.md. |
| `context/archive/2026-10-01-ui-mg-dashboard/` | narrative | Archived UI change: change.md, plan-brief.md, plan.md, research.md, reviews/impl-review.md. |
| `context/archive/2026-10-01-ui-auth-signin/` | narrative | Archived UI change: change.md, plan-brief.md, plan.md, research.md, reviews/impl-review.md. |
| `context/archive/2026-10-01-signed-in-landing/` | narrative | Archived change: change.md, plan-brief.md, plan.md, reviews/impl-review.md. |
| `context/archive/2026-09-30-ui-new-session-board/` | narrative | Archived UI change: change.md, plan-brief.md, plan.md, research.md, reviews/impl-review.md. |
| `context/archive/2026-09-27-seed-phrase-reward-catalog/` | narrative | Archived change: change.md, plan-brief.md, plan.md, reviews/impl-review.md. |
| `context/archive/2026-09-27-gm-create-session-board/` | narrative | Archived change: change.md, plan-brief.md, plan.md, reviews/impl-review.md. |
| `README.md` | reference | Starter-template readme. Thin on product behavior. |
| `CLAUDE.md` | reference | Agent instructions: commands, architecture, auth flow, conventions. |
| `AGENTS.md` | reference | Shorter agent instructions pointing at CLAUDE.md. |
| `context/ideas/phrases.md` | reference | Parked catalog ideas. |
| `context/ideas/rewards.md` | reference | Parked catalog ideas. |
| `supabase/seed.sql` | reference | Seed rows. The docs agent may read it as catalog copy. Do not treat SQL behavior as a document rule; schema behavior is for the code agents. |
| `context/foundation/test-plan.md` | engineering | Test strategy and risk map. Read for rules only. |
| `context/foundation/test-stack.md` | engineering | Test tooling. Read for rules only. |
| `context/foundation/tech-stack.md` | engineering | Stack decision. Read for rules only. |
| `context/foundation/infrastructure.md` | engineering | Deployment platform decision. Read for rules only. |
| `context/foundation/lessons.md` | engineering | Team lessons. Read for rules only. |
| `context/deployment/deploy-plan.md` | engineering | First-deploy record. Read for rules only. |
| `context/audits/observability/2026-10-07_auth-create-session-join-claim.md` | engineering | Observability audit. Read for rules only. |
| `context/changes/bootstrap-verification/verification.md` | engineering | Scaffold verification log. Read for rules only. |

`context/changes/` has no open product change besides the bootstrap log. `context/archive/README.md` and `context/foundation/README.md` are directory conventions, not domain documents.

## Product goals

The product goal is the v1 vision. prd-v2 repeats it in one sentence and then states a change.

> Mistrz Gry prowadzący sesję papierowego RPG (np. D&D) chce, żeby gracze w trakcie sesji wychodzili poza rutynę — odgrywali sceny, podejmowali ryzyko, zwracali uwagę na rzeczy, które normalnie by pominęli — i żeby nagrody typu inspiracja wynikały z czytelnej reguły, a nie z uznaniowej decyzji MG. (`context/foundation/prd.md:22`)

> Wspólna plansza dla całej sesji z zasadą "pole zajęte raz" zamienia bingo z solo-zabawy w mechanikę drużynową z lekką rywalizacją; powiązanie nagrody z konkretnym, widocznym dla wszystkich polem usuwa uznaniowość. (`context/foundation/prd.md:24`)

> **Cel (jedno zdanie):** Wspólna plansza bingo na sesję papierowego RPG — hasła z bazy RPG i własne MG, pole zajęte raz, nagroda na widocznym polu — żeby inspiracja wynikała z reguły, a nie z uznania MG. (`context/foundation/prd-v2.md:22`)

Primary success (product, v1):

> Jedna prawdziwa sesja przy stole przechodzi cały przepływ MVP: MG generuje planszę (5x5, własne hasła, nagrody), gracze wchodzą kodem z telefonów, co najmniej jeden gracz oznacza pole po słownym potwierdzeniu MG i widzi nagrodę, a pozostali po odświeżeniu widzą pole jako zajęte. (`context/foundation/prd.md:39`)

Secondary:

> Drużyna zdobywa nagrodę drużynową (linię/układ pól) w trakcie sesji. (`context/foundation/prd.md:42`)

Guardrails:

> Nigdy dwóch graczy nie posiada tego samego pola — nawet gdy klikną niemal równocześnie. (`context/foundation/prd.md:45`)

> Stan planszy przetrwa odświeżenie strony, zerwanie sieci i ponowne wejście kodem. (`context/foundation/prd.md:47`)

Non-goals (product):

> Aplikacja nie weryfikuje wykonania zadania — nie integruje się z rzutami kości, VTT ani kartami postaci; uznanie należy do MG przy stole. (`context/foundation/prd.md:143`)

> Brak współprowadzenia — jedna sesja ma jednego MG. (`context/foundation/prd.md:145`)

> Brak statystyk i historii gracza między sesjami — gracz nie ma tożsamości poza jedną sesją (`context/foundation/prd.md:142`)

> Brak synchronizacji na żywo (`context/foundation/prd.md:148`)

Persona:

> **Persona główna: Mistrz Gry (MG).** (`context/foundation/prd.md:28`)

> **Gracz.** Członek drużyny. (`context/foundation/prd.md:32`)

## Change goals

These judge the v2 delta, not the Core of the product.

> Po wdrożeniu: gracz dołącza skanując QR z ekranu MG; po zdobyciu pola (także bez nagrody) ma odczuwalną satysfakcję; MG może usunąć stare sesje i nie zaśmieca sobie ekranu — przy zachowanym dołączaniu do planszy. (`context/foundation/prd-v2.md:49`)

> Dołączanie do planszy nadal działa (w tym istniejący flow z kodem nie może się zepsuć przez QR/link). (`context/foundation/prd-v2.md:55`)

> Usunięcie sesji nie kasuje aktywnej sesji bez świadomej akcji MG. (`context/foundation/prd-v2.md:56`)

> **M-2: QR, nagrody progowe i sprzątanie sesji** (`context/foundation/roadmap.md:24`)

> **North star** tu oznacza: najmniejszy slice end-to-end, którego dostarczenie udowadnia rdzeń hipotezy produktu (`context/foundation/roadmap.md:39`) — the north star named there is a milestone slice (S-02), not a replacement of the v1 vision.

## Limitations

- prd.md and prd-v2.md are both `status: draft`. prd-v2 is newer (2026-10-11) but scoped as a change; it does not repeal the v1 vision. Where they conflict, the docs agent must cite both and mark which is newer.
- README does not describe the product.
- No ADR/RFC directory. Decisions live in change folders and in shape-notes frontmatter.
- No user-facing help or FAQ.
