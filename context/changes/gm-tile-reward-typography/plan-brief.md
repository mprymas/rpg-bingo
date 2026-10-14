# Fix MG tile reward typography + ellipsis — Plan Brief

> Full plan: `context/changes/gm-tile-reward-typography/plan.md`

## What & Why

Na kafelku pola planszy MG etykieta nagrody jest za duża względem hasła, a przy długiej treści komórka ucina początek i koniec (wyśrodkowany overflow). Naprawiamy rozmiar (ten sam fluid `clamp` co hasło) i wymuszamy single-line end-ellipsis przy zachowanym chipie Badge na wolnym polu.

## Starting Point

`GmBoard` pokazuje nagrodę na wolnym polu przez shadcn `Badge` (`text-xs`, `w-fit`, `shrink-0`) oraz na zajętym przez `player-board-cell-reward` (clamp + deklarowany ellipsis). Hasło już używa `player-board-cell-phrase` z docelowym `clamp`. Kitchen-sink ma tylko krótkie etykiety.

## Desired End State

MG widzi etykiety nagród w rozmiarze zbliżonym do hasła; krótkie teksty w całości, długie z widocznym początkiem i `…` na końcu — bez obustronnego clipu. Badge na wolnym polu zostaje. Kitchen-sink ma bramkę z długą etykietą (wolne + zajęte).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) |
| -------- | ------ | ---------------- |
| Scope | Tylko etykieta nagrody na kafelku pola w `GmBoard` (wolne + zajęte) | Bug dotyczy chipa/spanu w komórce; line slots i roster to osobne powierzchnie |
| Font size | Ten sam `clamp` co phrase / `player-board-cell-reward` | Spójność z treścią pola i istniejącym tokenem |
| Free-cell look | Zachować `Badge secondary` + lokalna utility | Zachowuje rozpoznawalny chip bez zmiany globalnego `badge.tsx` |
| Kitchen-sink | Sekcja z długą etykietą (wolne + zajęte) | Powtarzalna bramka wizualna bez szukania długiego labela w katalogu |

## Scope

**In scope:**

- `player-board-cell-reward` display/ellipsis fix
- Nowa utility pod Badge na wolnym polu MG + wiring w `GmBoard`
- Kitchen-sink long-label fixture

**Out of scope:**

- Line slots, roster threshold
- Global `Badge` / API / seed / DB limits
- `BoardGrid.astro`
- Osobna zmiana widoku gracza (poza side-effectem współdzielonego CSS claimed)

## Architecture / Approach

Tokenized `@utility` w `global.css` (wspólny clamp + bounded end-ellipsis) + lokalne klasy na Badge w `GmBoard`. Bez zmian w `badge.tsx`. Claimed markup bez zmian poza działającym utility.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. CSS + GmBoard | Działający clamp + end-ellipsis na wolnym i zajętym kafelku MG | Badge `shrink-0`/`w-fit` nadal wygrywa bez wystarczającego override |
| 2. Kitchen-sink gate | Widoczna długa etykieta do eyeball check | Fixture za krótki, by wymusić overflow na telefonie |

**Prerequisites:** Dev server lub preview; dostęp do `/sessions/board/kitchen-sink` (DEV).
**Estimated effort:** ~1 session across 2 phases

## Open Risks & Assumptions

- Fix `display` na `player-board-cell-reward` dotyczy też claimed labels w `PlayerBoard` — traktujemy to jako pożądany/shared ellipsis side-effect, nie osobny scope.
- Roadmap nie indeksuje tego Change ID — sync pominięty.

## Success Criteria (Summary)

- Długa nagroda na kafelku MG: początek + `…`, bez ucięcia obu stron
- Rozmiar etykiety zbliżony do hasła na wolnym polu
- Kitchen-sink udowadnia wolne (Badge) i zajęte (span) stany
