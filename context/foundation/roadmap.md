---
project: RPG Bingo
version: 2
status: draft
created: 2026-10-11
updated: 2026-10-11
prd_version: 2
main_goal: speed
top_blocker: none
milestone_id: qr-rewards-session-cleanup
milestone_seq: 2
milestone_status: open
---


# Roadmap: RPG Bingo

> Derived from `context/foundation/prd-v2.md` (v2) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-2: QR, nagrody progowe i sprzątanie sesji** — Status: open

- **Intent:** Po prawdziwej sesji przy stole domknąć trzy ujawnione braki: łatwiejsze dołączenie (QR), sens pól poza nagrodą per-pole (progi / układy) oraz usuwanie starych sesji przez MG — bez regresji istniejącego joinu kodem.
- **Source materials:** `context/foundation/prd-v2.md` (v2)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** US-01, US-02; Scope must-have (Dołączanie QR + join kodem preserved; usuwanie sesji; nagrody za liczbę/układy + per-pole preserved); Primary Success Criterion + guardrails.

## Vision recap

Po rozegranej sesji przy stole wyszły trzy braki: MG nie sprząta starych sesji, pola bez nagrody nie dają celu, a dołączenie przez adres + kod tarło przy stole. Ta zmiana domyka te luki (QR, bogatsze nagrody, usuwanie), zachowując istniejący flow dołączenia kodem.

## North star

**S-02: Gracz zdobywa nagrodę za liczbę pól / układ i czuje satysfakcję przy claim** — validation milestone przy `speed`: to tu leży zmiana Business Logic i hipoteza „pola mają cel także poza nagrodą per-pole”; US-01 domyka się razem z równoległym S-01 (QR).

> **North star** tu oznacza: najmniejszy slice end-to-end, którego dostarczenie udowadnia rdzeń hipotezy produktu — ustawiony tak wcześnie, jak pozwolą Prerequisites, bo reszta ma sens dopiero gdy to działa.

## At a glance

| ID   | Change ID                  | Outcome (user can …)                                                                 | Prerequisites | PRD refs     | Status |
| ---- | -------------------------- | ------------------------------------------------------------------------------------ | ------------- | ------------ | ------ |
| S-01 | player-join-via-qr         | gracz dołącza skanując QR; join wpisanym kodem nadal działa                          | —             | US-01        | in-progress |
| S-02 | threshold-pattern-rewards  | gracz zdobywa nagrody za liczbę pól / układ; przy claimie czuje satysfakcję; per-pole bez regresji | —             | US-01        | ready  |
| S-03 | gm-delete-session          | MG usuwa sesję (dowolny status) po potwierdzeniu; bez potwierdzenia nic nie znika      | —             | US-02        | in-progress |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                 | Chain  | Note                                                                 |
| ------ | --------------------- | ------ | -------------------------------------------------------------------- |
| A      | Dołączanie QR         | `S-01` | Równolegle z B/C; domyka tarcie przy stole z Primary SC.             |
| B      | Nagrody progowe       | `S-02` | North star; inwestycja w regułę nagród; równolegle z A (join kodem wystarczy do weryfikacji). |
| C      | Sprzątanie sesji (MG) | `S-03` | Niezależne od A/B; szybki win dla MG przy `speed`.                   |

## Baseline

What's already in place in the codebase as of `2026-10-11` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 7 SSR + React 19 + Tailwind 4 + shadcn (`package.json`, `src/pages/`)
- **Backend / API:** present — SSR API: auth, play, sessions (`src/pages/api/`)
- **Data:** partial — Supabase + migrations + seed; bez osobnego ORM/drivera
- **Auth:** present — Supabase SSR + middleware getUser / PROTECTED_ROUTES
- **Deploy / infra:** partial — Cloudflare Workers + wrangler + CI deploy; bez Dockera (oczekiwane)
- **Observability:** partial — Sentry + reportError + Workers observability; bez osobnego loggera/metrics

## Foundations

Brak nowych Foundations — baseline pokrywa warstwy potrzebne do S-01…S-03; kontrakty QR, reguł nagród i usuwania wchodzą w pionowe slice’y (progressive disclosure).

## Slices

### S-01: Gracz dołącza przez QR

- **Outcome:** gracz dołącza do planszy skanując kod QR z ekranu MG (bez wpisywania adresu i kodu); dołączanie wpisanym kodem nadal działa jak dziś.
- **Change ID:** player-join-via-qr
- **PRD refs:** US-01; Scope §Dołączanie (QR new + kod preserved); Constraints (join kodem nienaruszony); NFR (QR nie zauważalnie wolniejsze niż kod)
- **Prerequisites:** —
- **Parallel with:** S-02, S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Pierwszy widoczny win przy stole; regresja joinu kodem to hard guardrail — sekwencjonowane równolegle z nagradami, nie przed nimi na siłę.
- **Status:** in-progress

### S-02: Nagrody za liczbę pól / układ + satysfakcja przy claim

- **Outcome:** gracz może zdobywać nagrody za ogólną liczbę zdobytych pól oraz za proste układy (np. wiersz/kolumna), nie tylko za konkretne pole; przy zdobyciu pola (także bez nagrody per-pole) ma odczuwalną satysfakcję; nagrody per-pole bez regresji; nowe reguły opcjonalne dla starych sesji.
- **Change ID:** threshold-pattern-rewards
- **PRD refs:** US-01; Scope §Nagrody (liczba/układy new + per-pole preserved); Business Logic Changes; Constraints (opcjonalność dla starych sesji)
- **Prerequisites:** —
- **Parallel with:** S-01, S-03
- **Blockers:** —
- **Unknowns:**
  - Jak prosty jest domyślny układ (sam wiersz/kolumna vs też przekątna)? — Owner: user. Block: no. (PRD podaje „np. cały wiersz/kolumna”; domyślnie wiersz+kolumna wystarczy przy `speed`.)
- **Risk:** Tu jest inwestycja w regułę nagród i ryzyko „księgowości”; proste progi + opcjonalność chronią lekkość bingo i stare sesje.
- **Status:** ready

### S-03: MG usuwa sesję po potwierdzeniu

- **Outcome:** MG widzi listę sesji, wybiera usunięcie i po potwierdzeniu sesja znika niezależnie od statusu; bez potwierdzenia nic się nie kasuje (aktywna sesja nie znika przypadkiem).
- **Change ID:** gm-delete-session
- **PRD refs:** US-02; Scope §Sesje; Success Criteria Guardrails (świadoma akcja)
- **Prerequisites:** —
- **Parallel with:** S-01, S-02
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Niezależny od stołu QR/nagród; przy `speed` warto brać równolegle, żeby MG nie utknął w zaśmieconej liście.
- **Status:** in-progress

## Backlog Handoff

| Roadmap ID | Change ID                 | Suggested issue title                                      | Ready for `/10x-plan` | Notes                                      |
| ---------- | ------------------------- | ---------------------------------------------------------- | --------------------- | ------------------------------------------ |
| S-01       | player-join-via-qr        | Gracz dołącza skanując QR; join kodem bez regresji         | yes                   | Run `/10x-plan player-join-via-qr`         |
| S-02       | threshold-pattern-rewards | Nagrody za liczbę pól / układ + satysfakcja przy claim     | yes                   | North star — Run `/10x-plan threshold-pattern-rewards` |
| S-03       | gm-delete-session         | MG usuwa sesję po potwierdzeniu (dowolny status)           | yes                   | Parallel — Run `/10x-plan gm-delete-session` |

This table is the clean handoff to Jira/Linear or any MCP-backed backlog. Include one row for every `F-NN` and `S-NN`. It should be compact enough to copy into issues, but it must not duplicate the detailed roadmap body.

## Open Roadmap Questions

1. **What is the one-sentence system purpose of the current product?** — Owner: user. Block: no (Current System Overview is partial until filled). Source: prd-v2 Open Questions.
2. **What is the key architecture of the current system?** — Owner: user. Block: no. Source: prd-v2 Open Questions.
3. **What is the current tech stack?** — Owner: user (or fill from known deployment reality). Block: no. Source: prd-v2 Open Questions.

## Parked

- **Konta graczy i historia między sesjami** — Why parked: prd-v2 §Non-Goals.
- **Wymuszanie nowych nagród / progów na starych sesjach** — Why parked: prd-v2 §Non-Goals; nowe zachowanie opcjonalne.
- **Natywna aplikacja mobilna** — Why parked: prd-v2 §Non-Goals; QR w przeglądarce wystarczy.

## Milestone History

- **M-1: First table session** (`first-table-session`) — closed 2026-10-11. Jedna sesja przy stole: MG generuje planszę, gracze dołączają kodem, claim pola + nagroda, undo i regeneracja.

## Done

- **F-01: (foundation) seedowane hasła predefiniowane i katalog nagród są dostępne do losowania planszy.** — Archived 2026-09-27 → `context/archive/2026-09-27-seed-phrase-reward-catalog/`. Lesson: —.
- **S-01: zalogowany MG tworzy sesję bingo (rozmiar, własne hasła, nagrody i ich liczba), generuje planszę i otrzymuje krótki kod sesji.** — Archived 2026-09-27 → `context/archive/2026-09-27-gm-create-session-board/`. Lesson: —.
- **S-02: gracz dołącza kodem i nickiem (bez konta) i widzi wspólną planszę z nagrodami na polach** — Archived 2026-10-03 → `context/archive/2026-10-03-player-join-shared-board/`. Lesson: —.
- **S-03: gracz oznacza wolne pole jako swoje, natychmiast widzi czy zdobył nagrodę; pole staje się niedostępne dla innych (zajętość widoczna u innych i u MG w ~10s przez polling ~5s); MG mapuje kolor → nick → nagrodę przez roster.** — Archived 2026-10-03 → context/archive/2026-10-03-player-claim-field-reward/. Lesson: —.
- **S-04: MG cofa błędne oznaczenie pola; pole wraca do puli wolnych, powiązana nagroda jest unieważniona.** — Archived 2026-10-03 → `context/archive/2026-10-03-gm-undo-field-claim/`. Lesson: —.
- **S-05: MG generuje nową planszę z nowym kodem; gracze muszą dołączyć do niej od nowa.** — Archived 2026-10-11 → `context/archive/2026-10-11-gm-regenerate-board/`. Lesson: —.
