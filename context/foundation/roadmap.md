---

## project: RPG Bingo
version: 1
status: draft
created: 2026-09-22
updated: 2026-10-03
prd_version: 1
main_goal: market-feedback
top_blocker: capacity
milestone_id: first-table-session
milestone_seq: 1
milestone_status: open

# Roadmap: RPG Bingo

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: First table session** — Status: open

- **Intent:** Udowodnić, że jedna prawdziwa sesja przy stole przechodzi cały przepływ MVP: MG generuje planszę, gracze dołączają kodem, ktoś oznacza pole i widzi nagrodę, pozostali widzą zajęte pole.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** US-01; must-have FR-001, FR-002, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012; Primary Success Criterion + guardrails z PRD.



## Vision recap

Mistrz Gry chce przy stole meta-wyzwania i lekką rywalizację zamiast uznaniowych inspiracji. Predefiniowana baza haseł RPG plus własne hasła MG dają planszę w chwilę; wspólna plansza z regułą „pole zajęte raz” i nagrodą przypiętą do widocznego pola usuwa uznaniowość. Produkt jest na własny stół i garść znajomych.

## North star

**S-03: Gracz zdobywa wolne pole i natychmiast widzi nagrodę** — to validation milestone (najmniejszy przepływ end-to-end, którego sukces udowadnia hipotezę produktu z Vision / Primary SC), bo dopiero oznaczenie pola + nagroda + zajętość dla innych pokazują „bingo zamiast uznaniowej inspiracji”.

> **North star** tu oznacza: najmniejszy slice end-to-end, którego dostarczenie udowadnia rdzeń hipotezy produktu — ustawiony tak wcześnie, jak pozwolą Prerequisites, bo reszta ma sens dopiero gdy to działa.



## At a glance


| ID   | Change ID                                            | Outcome (user can …)                                                                    | Prerequisites | PRD refs                                  | Status   |
| ---- | ---------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------- | ----------------------------------------- | -------- |
| F-01 | seed-phrase-reward-catalog | (foundation) seedowane hasła predefiniowane i katalog nagród gotowe do losowania        | —             | FR-005, FR-016 (MVP seed), Business Logic | done |
| S-01 | gm-create-session-board                              | zalogowany MG tworzy sesję, generuje planszę i dostaje krótki kod                       | F-01          | US-01, FR-001, FR-004, FR-005, FR-006     | done |
| S-02 | player-join-shared-board                             | gracz dołącza kodem i nickiem (bez konta) i widzi wspólną planszę z nagrodami na polach | S-01          | US-01, FR-002, FR-008, FR-010             | done |
| S-03 | player-claim-field-reward                            | gracz oznacza wolne pole, widzi nagrodę; inni widzą zajęte pole w ~10s (poll)             | S-02          | US-01, FR-009, FR-011                     | done |
| S-04 | gm-undo-field-claim                                  | MG cofa błędne oznaczenie; pole wraca i nagroda jest unieważniona                       | S-03          | FR-012                                    | proposed |
| S-05 | gm-regenerate-board                                  | MG generuje nową planszę (nowy kod); gracze dołączają od nowa                           | S-02          | FR-007                                    | proposed |




## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.


| Stream | Theme             | Chain                                      | Note                                                                  |
| ------ | ----------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| A      | Sesja i rozgrywka | `F-01` → `S-01` → `S-02` → `S-03` → `S-04` | Ścieżka do north star (market-feedback); cofnięcie domyka stół.       |
| B      | Nowa plansza      | `S-05`                                     | Dołącza do Stream A przy `S-02`; może iść równolegle z `S-03`/`S-04`. |




## Baseline

What's already in place in the codebase as of `2026-09-22` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 7 + React 19 + Tailwind 4 + shadcn; pages under `src/pages/`
- **Backend / API:** present — Astro SSR on Cloudflare Workers; auth API under `src/pages/api/auth/`
- **Data:** partial — Supabase client wired; no SQL migrations and no `seed.sql` on disk yet
- **Auth:** present — Supabase SSR cookies, middleware `getUser`, signin/signup/signout
- **Deploy / infra:** partial — Cloudflare Workers + GitHub Actions deploy; no Dockerfile (expected for Workers)
- **Observability:** partial — Workers observability flag only; no app-level error tracking



## Foundations



### F-01: Seedowane hasła i katalog nagród

- **Outcome:** (foundation) seedowane hasła predefiniowane i katalog nagród są dostępne do losowania planszy.
- **Change ID:** seed-phrase-reward-catalog
- **PRD refs:** FR-005, FR-016 (MVP bez ekranu admina — seed przy wdrożeniu), Business Logic (pula haseł i nagród)
- **Unlocks:** S-01
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Bez seeda S-01 nie ma z czego losować planszy; to najmniejszy kontrakt danych przed pierwszą ścieżką MG (schema sesji/planszy wchodzi dopiero w S-01).
- **Status:** done



## Slices



### S-01: MG tworzy sesję i dostaje kod

- **Outcome:** zalogowany MG tworzy sesję bingo (rozmiar, własne hasła, nagrody i ich liczba), generuje planszę i otrzymuje krótki kod sesji.
- **Change ID:** gm-create-session-board
- **PRD refs:** US-01, FR-001, FR-004, FR-005, FR-006
- **Prerequisites:** F-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Co gdy haseł < liczby pól na planszy większej niż 5×5? — Owner: użytkownik. Block: no. (PRD Open Q2; przy domyślnym 5×5 seed ≥ 25 wystarcza.)
- **Risk:** Pierwszy vertical slice wprowadza trwałość sesji/planszy; bez niego nie ma dołączenia gracza ani north star.
- **Status:** done



### S-02: Gracz dołącza i widzi wspólną planszę

- **Outcome:** gracz dołącza do aktywnej sesji kodem i nickiem bez konta, widzi wspólną planszę z aktualnym stanem pól oraz które pola oferują jaką nagrodę.
- **Change ID:** player-join-shared-board
- **PRD refs:** US-01, FR-002, FR-008, FR-010
- **Prerequisites:** S-01
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Odblokowuje ścieżkę bezkontową i widok nagród od początku; Prerequisite dla claim i regeneracji.
- **Status:** done



### S-03: Gracz zdobywa pole i nagrodę

- **Outcome:** gracz oznacza wolne pole jako swoje, natychmiast widzi czy zdobył nagrodę; pole staje się niedostępne dla innych (zajętość widoczna u innych i u MG w ~10s przez polling ~5s); MG mapuje kolor → nick → nagrodę przez roster.
- **Change ID:** player-claim-field-reward
- **PRD refs:** US-01, FR-009, FR-011
- **Prerequisites:** S-02
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Tu leży guardrail „nigdy dwóch graczy na tym samym polu” przy niemal równoczesnych kliknięciach — najwcześniejszy dowód Primary SC; przy `capacity` warto nie odkładać.
- **Status:** done



### S-04: MG cofa błędne oznaczenie

- **Outcome:** MG cofa błędne oznaczenie pola; pole wraca do puli wolnych, powiązana nagroda jest unieważniona.
- **Change ID:** gm-undo-field-claim
- **PRD refs:** FR-012
- **Prerequisites:** S-03
- **Parallel with:** S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Zaufanie MG przy stole; bez cofnięcia błędny klik psuje sesję — po north star, nie przed.
- **Status:** proposed



### S-05: MG generuje nową planszę

- **Outcome:** MG generuje nową planszę z nowym kodem; gracze muszą dołączyć do niej od nowa.
- **Change ID:** gm-regenerate-board
- **PRD refs:** FR-007
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Domknięcie must-have ścieżki „kolejna plansza”; równoległe z claim/undo dzięki wspólnemu Prerequisite S-02 — dźwignia przy `capacity`.
- **Status:** proposed



## Backlog Handoff


| Roadmap ID | Change ID                  | Suggested issue title                                         | Ready for `/10x-plan` | Notes                                                                                            |
| ---------- | -------------------------- | ------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| F-01       | seed-phrase-reward-catalog | Seed haseł predefiniowanych i katalogu nagród                 | yes                   | [#1](https://github.com/mprymas/rpg-bingo/issues/1) — Run `/10x-plan seed-phrase-reward-catalog` |
| S-01       | gm-create-session-board    | MG tworzy sesję, generuje planszę, dostaje kod                | no                    | [#2](https://github.com/mprymas/rpg-bingo/issues/2) — Czeka na F-01                              |
| S-02       | player-join-shared-board   | Gracz dołącza kodem/nickiem i widzi planszę z nagrodami       | no                    | [#3](https://github.com/mprymas/rpg-bingo/issues/3) — Czeka na S-01                              |
| S-03       | player-claim-field-reward  | Gracz oznacza pole i widzi nagrodę                            | —                     | [#4](https://github.com/mprymas/rpg-bingo/issues/4) — done                                       |
| S-04       | gm-undo-field-claim        | MG cofa oznaczenie pola i unieważnia nagrodę                  | yes                   | [#5](https://github.com/mprymas/rpg-bingo/issues/5) — Prerequisites S-03 done                    |
| S-05       | gm-regenerate-board        | MG generuje nową planszę (nowy kod), gracze dołączają od nowa | no                    | [#6](https://github.com/mprymas/rpg-bingo/issues/6) — Czeka na S-02; parallel z S-03/S-04        |




## Open Roadmap Questions

1. **Jak zdefiniowany jest "układ" dający nagrodę drużynową (FR-014)?** — pełna linia (wiersz/kolumna/przekątna) przez dowolnych graczy, cała plansza, inny wzór? Owner: użytkownik. Block: nie (FR nice-to-have) — `roadmap-wide` dopiero gdy FR-014 wejdzie do scope. Issue: [#7](https://github.com/mprymas/rpg-bingo/issues/7).
2. **Co dzieje się, gdy haseł (predefiniowane + własne) jest mniej niż pól na wybranej planszy?** — Założenie MVP: baza predefiniowana jest zawsze większa niż 25 haseł, więc przypadek nie występuje przy domyślnym 5x5. Do rozstrzygnięcia dla większych plansz. Owner: użytkownik. Block: nie (gates soft: S-01). Issue: [#8](https://github.com/mprymas/rpg-bingo/issues/8).



## Parked

- **Statystyki i historia gracza między sesjami** — Why parked: PRD §Non-Goals; wynika z FR-002 (bez konta). Issue: [#9](https://github.com/mprymas/rpg-bingo/issues/9).
- **Weryfikacja wykonania zadania (kości / VTT / karty)** — Why parked: PRD §Non-Goals; uznanie należy do MG przy stole. Issue: [#10](https://github.com/mprymas/rpg-bingo/issues/10).
- **Współdzielenie haseł między MG / biblioteka społeczności** — Why parked: PRD §Non-Goals. Issue: [#11](https://github.com/mprymas/rpg-bingo/issues/11).
- **Współprowadzenie sesji (wielu MG)** — Why parked: PRD §Non-Goals. Issue: [#12](https://github.com/mprymas/rpg-bingo/issues/12).
- **Synchronizacja push / live sync (FR-013)** — Why parked: PRD §Non-Goals + Forward: technical-roadmap; NFR ≤ 10 s bez push. Issue: [#13](https://github.com/mprymas/rpg-bingo/issues/13).
- **Tryb offline, WCAG AA, wielojęzyczność** — Why parked: PRD §Non-Goals. Issue: [#14](https://github.com/mprymas/rpg-bingo/issues/14).
- **FR-003 — plansza przed rejestracją** — Why parked: nice-to-have; `capacity` + market-feedback → poza pierwszym milestone. Issue: [#15](https://github.com/mprymas/rpg-bingo/issues/15).
- **FR-014 / FR-015 — nagrody drużynowe i własne nagrody MG** — Why parked: nice-to-have; Secondary SC i Open Q1; poza M-1. Issue: [#16](https://github.com/mprymas/rpg-bingo/issues/16).
- **FR-016 / FR-017 — ekran admina haseł i filtry kategorii** — Why parked: nice-to-have; MVP = seed (F-01), bez ekranu edycji. Issue: [#17](https://github.com/mprymas/rpg-bingo/issues/17).



## Milestone History

(Empty — first milestone.)

## Done

- **F-01: (foundation) seedowane hasła predefiniowane i katalog nagród są dostępne do losowania planszy.** — Archived 2026-09-27 → `context/archive/2026-09-27-seed-phrase-reward-catalog/`. Lesson: —.
- **S-01: zalogowany MG tworzy sesję bingo (rozmiar, własne hasła, nagrody i ich liczba), generuje planszę i otrzymuje krótki kod sesji.** — Archived 2026-09-27 → `context/archive/2026-09-27-gm-create-session-board/`. Lesson: —.
- **S-02: gracz dołącza kodem i nickiem (bez konta) i widzi wspólną planszę z nagrodami na polach** — Archived 2026-10-03 → `context/archive/2026-10-03-player-join-shared-board/`. Lesson: —.
- **S-03: gracz oznacza wolne pole jako swoje, natychmiast widzi czy zdobył nagrodę; pole staje się niedostępne dla innych (zajętość widoczna u innych i u MG w ~10s przez polling ~5s); MG mapuje kolor → nick → nagrodę przez roster.** — Archived 2026-10-03 → context/archive/2026-10-03-player-claim-field-reward/. Lesson: —.
