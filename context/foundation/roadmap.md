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

**M-1: First table session** â€” Status: open

- **Intent:** UdowodniÄ‡, Å¼e jedna prawdziwa sesja przy stole przechodzi caÅ‚y przepÅ‚yw MVP: MG generuje planszÄ™, gracze doÅ‚Ä…czajÄ… kodem, ktoÅ› oznacza pole i widzi nagrodÄ™, pozostali widzÄ… zajÄ™te pole.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** US-01; must-have FR-001, FR-002, FR-004, FR-005, FR-006, FR-007, FR-008, FR-009, FR-010, FR-011, FR-012; Primary Success Criterion + guardrails z PRD.



## Vision recap

Mistrz Gry chce przy stole meta-wyzwania i lekkÄ… rywalizacjÄ™ zamiast uznaniowych inspiracji. Predefiniowana baza haseÅ‚ RPG plus wÅ‚asne hasÅ‚a MG dajÄ… planszÄ™ w chwilÄ™; wspÃ³lna plansza z reguÅ‚Ä… â€žpole zajÄ™te razâ€ i nagrodÄ… przypiÄ™tÄ… do widocznego pola usuwa uznaniowoÅ›Ä‡. Produkt jest na wÅ‚asny stÃ³Å‚ i garÅ›Ä‡ znajomych.

## North star

**S-03: Gracz zdobywa wolne pole i natychmiast widzi nagrodÄ™** â€” to validation milestone (najmniejszy przepÅ‚yw end-to-end, ktÃ³rego sukces udowadnia hipotezÄ™ produktu z Vision / Primary SC), bo dopiero oznaczenie pola + nagroda + zajÄ™toÅ›Ä‡ dla innych pokazujÄ… â€žbingo zamiast uznaniowej inspiracjiâ€.

> **North star** tu oznacza: najmniejszy slice end-to-end, ktÃ³rego dostarczenie udowadnia rdzeÅ„ hipotezy produktu â€” ustawiony tak wczeÅ›nie, jak pozwolÄ… Prerequisites, bo reszta ma sens dopiero gdy to dziaÅ‚a.



## At a glance


| ID   | Change ID                                            | Outcome (user can â€¦)                                                                    | Prerequisites | PRD refs                                  | Status   |
| ---- | ---------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------- | ----------------------------------------- | -------- |
| F-01 | seed-phrase-reward-catalog | (foundation) seedowane hasÅ‚a predefiniowane i katalog nagrÃ³d gotowe do losowania        | â€”             | FR-005, FR-016 (MVP seed), Business Logic | done |
| S-01 | gm-create-session-board                              | zalogowany MG tworzy sesjÄ™, generuje planszÄ™ i dostaje krÃ³tki kod                       | F-01          | US-01, FR-001, FR-004, FR-005, FR-006     | done |
| S-02 | player-join-shared-board                             | gracz doÅ‚Ä…cza kodem i nickiem (bez konta) i widzi wspÃ³lnÄ… planszÄ™ z nagrodami na polach | S-01          | US-01, FR-002, FR-008, FR-010             | done |
| S-03 | player-claim-field-reward                            | gracz oznacza wolne pole, widzi nagrodÄ™; inni widzÄ… zajÄ™te pole w ~10s (poll)             | S-02          | US-01, FR-009, FR-011                     | done |
| S-04 | gm-undo-field-claim                                  | MG cofa bÅ‚Ä™dne oznaczenie; pole wraca i nagroda jest uniewaÅ¼niona                       | S-03          | FR-012                                    | proposed |
| S-05 | gm-regenerate-board                                  | MG generuje nowÄ… planszÄ™ (nowy kod); gracze doÅ‚Ä…czajÄ… od nowa                           | S-02          | FR-007                                    | proposed |




## Streams

Navigation aid â€” groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.


| Stream | Theme             | Chain                                      | Note                                                                  |
| ------ | ----------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| A      | Sesja i rozgrywka | `F-01` â†’ `S-01` â†’ `S-02` â†’ `S-03` â†’ `S-04` | ÅšcieÅ¼ka do north star (market-feedback); cofniÄ™cie domyka stÃ³Å‚.       |
| B      | Nowa plansza      | `S-05`                                     | DoÅ‚Ä…cza do Stream A przy `S-02`; moÅ¼e iÅ›Ä‡ rÃ³wnolegle z `S-03`/`S-04`. |




## Baseline

What's already in place in the codebase as of `2026-09-22` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present â€” Astro 7 + React 19 + Tailwind 4 + shadcn; pages under `src/pages/`
- **Backend / API:** present â€” Astro SSR on Cloudflare Workers; auth API under `src/pages/api/auth/`
- **Data:** partial â€” Supabase client wired; no SQL migrations and no `seed.sql` on disk yet
- **Auth:** present â€” Supabase SSR cookies, middleware `getUser`, signin/signup/signout
- **Deploy / infra:** partial â€” Cloudflare Workers + GitHub Actions deploy; no Dockerfile (expected for Workers)
- **Observability:** partial â€” Workers observability flag only; no app-level error tracking



## Foundations



### F-01: Seedowane hasÅ‚a i katalog nagrÃ³d

- **Outcome:** (foundation) seedowane hasÅ‚a predefiniowane i katalog nagrÃ³d sÄ… dostÄ™pne do losowania planszy.
- **Change ID:** seed-phrase-reward-catalog
- **PRD refs:** FR-005, FR-016 (MVP bez ekranu admina â€” seed przy wdroÅ¼eniu), Business Logic (pula haseÅ‚ i nagrÃ³d)
- **Unlocks:** S-01
- **Prerequisites:** â€”
- **Parallel with:** â€”
- **Blockers:** â€”
- **Unknowns:** â€”
- **Risk:** Bez seeda S-01 nie ma z czego losowaÄ‡ planszy; to najmniejszy kontrakt danych przed pierwszÄ… Å›cieÅ¼kÄ… MG (schema sesji/planszy wchodzi dopiero w S-01).
- **Status:** done



## Slices



### S-01: MG tworzy sesjÄ™ i dostaje kod

- **Outcome:** zalogowany MG tworzy sesjÄ™ bingo (rozmiar, wÅ‚asne hasÅ‚a, nagrody i ich liczba), generuje planszÄ™ i otrzymuje krÃ³tki kod sesji.
- **Change ID:** gm-create-session-board
- **PRD refs:** US-01, FR-001, FR-004, FR-005, FR-006
- **Prerequisites:** F-01
- **Parallel with:** â€”
- **Blockers:** â€”
- **Unknowns:**
  - Co gdy haseÅ‚ < liczby pÃ³l na planszy wiÄ™kszej niÅ¼ 5Ã—5? â€” Owner: uÅ¼ytkownik. Block: no. (PRD Open Q2; przy domyÅ›lnym 5Ã—5 seed â‰¥ 25 wystarcza.)
- **Risk:** Pierwszy vertical slice wprowadza trwaÅ‚oÅ›Ä‡ sesji/planszy; bez niego nie ma doÅ‚Ä…czenia gracza ani north star.
- **Status:** done



### S-02: Gracz doÅ‚Ä…cza i widzi wspÃ³lnÄ… planszÄ™

- **Outcome:** gracz doÅ‚Ä…cza do aktywnej sesji kodem i nickiem bez konta, widzi wspÃ³lnÄ… planszÄ™ z aktualnym stanem pÃ³l oraz ktÃ³re pola oferujÄ… jakÄ… nagrodÄ™.
- **Change ID:** player-join-shared-board
- **PRD refs:** US-01, FR-002, FR-008, FR-010
- **Prerequisites:** S-01
- **Parallel with:** â€”
- **Blockers:** â€”
- **Unknowns:** â€”
- **Risk:** Odblokowuje Å›cieÅ¼kÄ™ bezkontowÄ… i widok nagrÃ³d od poczÄ…tku; Prerequisite dla claim i regeneracji.
- **Status:** done



### S-03: Gracz zdobywa pole i nagrodÄ™

- **Outcome:** gracz oznacza wolne pole jako swoje, natychmiast widzi czy zdobyÅ‚ nagrodÄ™; pole staje siÄ™ niedostÄ™pne dla innych (zajÄ™toÅ›Ä‡ widoczna u innych i u MG w ~10s przez polling ~5s); MG mapuje kolor â†’ nick â†’ nagrodÄ™ przez roster.
- **Change ID:** player-claim-field-reward
- **PRD refs:** US-01, FR-009, FR-011
- **Prerequisites:** S-02
- **Parallel with:** S-05
- **Blockers:** â€”
- **Unknowns:** â€”
- **Risk:** Tu leÅ¼y guardrail â€žnigdy dwÃ³ch graczy na tym samym poluâ€ przy niemal rÃ³wnoczesnych klikniÄ™ciach â€” najwczeÅ›niejszy dowÃ³d Primary SC; przy `capacity` warto nie odkÅ‚adaÄ‡.
- **Status:** done



### S-04: MG cofa bÅ‚Ä™dne oznaczenie

- **Outcome:** MG cofa bÅ‚Ä™dne oznaczenie pola; pole wraca do puli wolnych, powiÄ…zana nagroda jest uniewaÅ¼niona.
- **Change ID:** gm-undo-field-claim
- **PRD refs:** FR-012
- **Prerequisites:** S-03
- **Parallel with:** S-05
- **Blockers:** â€”
- **Unknowns:** â€”
- **Risk:** Zaufanie MG przy stole; bez cofniÄ™cia bÅ‚Ä™dny klik psuje sesjÄ™ â€” po north star, nie przed.
- **Status:** proposed



### S-05: MG generuje nowÄ… planszÄ™

- **Outcome:** MG generuje nowÄ… planszÄ™ z nowym kodem; gracze muszÄ… doÅ‚Ä…czyÄ‡ do niej od nowa.
- **Change ID:** gm-regenerate-board
- **PRD refs:** FR-007
- **Prerequisites:** S-02
- **Parallel with:** S-03, S-04
- **Blockers:** â€”
- **Unknowns:** â€”
- **Risk:** DomkniÄ™cie must-have Å›cieÅ¼ki â€žkolejna planszaâ€; rÃ³wnolegÅ‚e z claim/undo dziÄ™ki wspÃ³lnemu Prerequisite S-02 â€” dÅºwignia przy `capacity`.
- **Status:** proposed



## Backlog Handoff


| Roadmap ID | Change ID                  | Suggested issue title                                         | Ready for `/10x-plan` | Notes                                                                                            |
| ---------- | -------------------------- | ------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------ |
| F-01       | seed-phrase-reward-catalog | Seed haseÅ‚ predefiniowanych i katalogu nagrÃ³d                 | yes                   | [#1](https://github.com/mprymas/rpg-bingo/issues/1) â€” Run `/10x-plan seed-phrase-reward-catalog` |
| S-01       | gm-create-session-board    | MG tworzy sesjÄ™, generuje planszÄ™, dostaje kod                | no                    | [#2](https://github.com/mprymas/rpg-bingo/issues/2) â€” Czeka na F-01                              |
| S-02       | player-join-shared-board   | Gracz doÅ‚Ä…cza kodem/nickiem i widzi planszÄ™ z nagrodami       | no                    | [#3](https://github.com/mprymas/rpg-bingo/issues/3) â€” Czeka na S-01                              |
| S-03       | player-claim-field-reward  | Gracz oznacza pole i widzi nagrodÄ™                            | â€”                     | [#4](https://github.com/mprymas/rpg-bingo/issues/4) â€” done                                       |
| S-04       | gm-undo-field-claim        | MG cofa oznaczenie pola i uniewaÅ¼nia nagrodÄ™                  | yes                   | [#5](https://github.com/mprymas/rpg-bingo/issues/5) â€” Prerequisites S-03 done                    |
| S-05       | gm-regenerate-board        | MG generuje nowÄ… planszÄ™ (nowy kod), gracze doÅ‚Ä…czajÄ… od nowa | no                    | [#6](https://github.com/mprymas/rpg-bingo/issues/6) â€” Czeka na S-02; parallel z S-03/S-04        |




## Open Roadmap Questions

1. **Jak zdefiniowany jest "ukÅ‚ad" dajÄ…cy nagrodÄ™ druÅ¼ynowÄ… (FR-014)?** â€” peÅ‚na linia (wiersz/kolumna/przekÄ…tna) przez dowolnych graczy, caÅ‚a plansza, inny wzÃ³r? Owner: uÅ¼ytkownik. Block: nie (FR nice-to-have) â€” `roadmap-wide` dopiero gdy FR-014 wejdzie do scope. Issue: [#7](https://github.com/mprymas/rpg-bingo/issues/7).
2. **Co dzieje siÄ™, gdy haseÅ‚ (predefiniowane + wÅ‚asne) jest mniej niÅ¼ pÃ³l na wybranej planszy?** â€” ZaÅ‚oÅ¼enie MVP: baza predefiniowana jest zawsze wiÄ™ksza niÅ¼ 25 haseÅ‚, wiÄ™c przypadek nie wystÄ™puje przy domyÅ›lnym 5x5. Do rozstrzygniÄ™cia dla wiÄ™kszych plansz. Owner: uÅ¼ytkownik. Block: nie (gates soft: S-01). Issue: [#8](https://github.com/mprymas/rpg-bingo/issues/8).



## Parked

- **Statystyki i historia gracza miÄ™dzy sesjami** â€” Why parked: PRD Â§Non-Goals; wynika z FR-002 (bez konta). Issue: [#9](https://github.com/mprymas/rpg-bingo/issues/9).
- **Weryfikacja wykonania zadania (koÅ›ci / VTT / karty)** â€” Why parked: PRD Â§Non-Goals; uznanie naleÅ¼y do MG przy stole. Issue: [#10](https://github.com/mprymas/rpg-bingo/issues/10).
- **WspÃ³Å‚dzielenie haseÅ‚ miÄ™dzy MG / biblioteka spoÅ‚ecznoÅ›ci** â€” Why parked: PRD Â§Non-Goals. Issue: [#11](https://github.com/mprymas/rpg-bingo/issues/11).
- **WspÃ³Å‚prowadzenie sesji (wielu MG)** â€” Why parked: PRD Â§Non-Goals. Issue: [#12](https://github.com/mprymas/rpg-bingo/issues/12).
- **Synchronizacja push / live sync (FR-013)** â€” Why parked: PRD Â§Non-Goals + Forward: technical-roadmap; NFR â‰¤ 10 s bez push. Issue: [#13](https://github.com/mprymas/rpg-bingo/issues/13).
- **Tryb offline, WCAG AA, wielojÄ™zycznoÅ›Ä‡** â€” Why parked: PRD Â§Non-Goals. Issue: [#14](https://github.com/mprymas/rpg-bingo/issues/14).
- **FR-003 â€” plansza przed rejestracjÄ…** â€” Why parked: nice-to-have; `capacity` + market-feedback â†’ poza pierwszym milestone. Issue: [#15](https://github.com/mprymas/rpg-bingo/issues/15).
- **FR-014 / FR-015 â€” nagrody druÅ¼ynowe i wÅ‚asne nagrody MG** â€” Why parked: nice-to-have; Secondary SC i Open Q1; poza M-1. Issue: [#16](https://github.com/mprymas/rpg-bingo/issues/16).
- **FR-016 / FR-017 â€” ekran admina haseÅ‚ i filtry kategorii** â€” Why parked: nice-to-have; MVP = seed (F-01), bez ekranu edycji. Issue: [#17](https://github.com/mprymas/rpg-bingo/issues/17).



## Milestone History

(Empty â€” first milestone.)

## Done

- **S-03: gracz oznacza wolne pole jako swoje, natychmiast widzi czy zdobył nagrodę; pole staje się niedostępne dla innych (zajętość widoczna u innych i u MG w ~10s przez polling ~5s); MG mapuje kolor → nick → nagrodę przez roster.** — Archived 2026-10-03 → `context/archive/2026-10-03-player-claim-field-reward/`. Lesson: —.
- **F-01: (foundation) seedowane hasÅ‚a predefiniowane i katalog nagrÃ³d sÄ… dostÄ™pne do losowania planszy.** â€” Archived 2026-09-27 â†’ `context/archive/2026-09-27-seed-phrase-reward-catalog/`. Lesson: â€”.
- **S-01: zalogowany MG tworzy sesjÄ™ bingo (rozmiar, wÅ‚asne hasÅ‚a, nagrody i ich liczba), generuje planszÄ™ i otrzymuje krÃ³tki kod sesji.** â€” Archived 2026-09-27 â†’ `context/archive/2026-09-27-gm-create-session-board/`. Lesson: â€”.
- **S-02: gracz doÅ‚Ä…cza kodem i nickiem (bez konta) i widzi wspÃ³lnÄ… planszÄ™ z nagrodami na polach** â€” Archived 2026-10-03 â†’ `context/archive/2026-10-03-player-join-shared-board/`. Lesson: â€”.
