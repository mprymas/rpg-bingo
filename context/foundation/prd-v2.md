---
project: "RPG Bingo"
version: 2
status: draft
created: 2026-10-11
context_type: brownfield
product_type: web-app
target_scale:
  users: small
timeline_budget:
  delivery_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

# RPG Bingo

## Current System Overview

MG może utworzyć planszę; gracze mogą dołączyć i oznaczać pola. Dołączenie wymaga wpisania adresu aplikacji, a potem kodu sesji. Nie ma usuwania starych sesji przez MG. Pola bez nagrody nie dają graczom wyraźnego celu.

**Cel (jedno zdanie):** Wspólna plansza bingo na sesję papierowego RPG — hasła z bazy RPG i własne MG, pole zajęte raz, nagroda na widocznym polu — żeby inspiracja wynikała z reguły, a nie z uznania MG.

**Architektura:** Aplikacja webowa SSR: Astro serwuje strony, React obsługuje interakcję. Supabase daje logowanie MG i Postgres, który ograniczeniami pilnuje „jedno pole, jeden właściciel”. Dołączenie gracza kodem sesji to logika aplikacji, bez konta. Plansza odświeża się pollingiem (bez websocketów); Supabase Realtime jest wyłączone. Wdrożenie na Cloudflare Workers; CI to GitHub Actions z auto-deploy po merge.

**Stack:** Astro 7 + React 19 + TypeScript + Tailwind 4 + Supabase (auth i Postgres) + Cloudflare Workers; npm; starter `10x-astro-starter`.

User base: small (własny stół / garść znajomych).

## Problem Statement & Motivation

Po rozegraniu faktycznej sesji z innymi graczami wyszły trzy braki w istniejącym produkcie:

1. MG nie może usuwać starych sesji — lista / historia się zapycha, a niepotrzebne sesje zostają.
2. Pola bez nagrody nie mają dla graczy wyraźnego celu.
3. Dołączenie wymaga wpisania adresu aplikacji i kodu — przy stole to tarcie; potrzebne ułatwienie, np. kod QR.

Kategoria zmiany: significant features (trzy w jednym kształcie). Insight: problemy ujawnione dopiero przy realnej grze, nie na papierze.

Must preserve: dołączanie do planszy nadal działa (istniejący flow nie może się zepsuć).

## User & Persona

**Persona główna: Mistrz Gry (MG).** Prowadzi sesję, tworzy planszę, zarządza stołem. Sięga po te zmiany, żeby posprzątać stare sesje, mieć sensowną planszę dla graczy (także poza nagrodami) i szybciej wprowadzić drużynę na planszę (np. QR zamiast dyktowania adresu i kodu).

## Success Criteria

### Primary
- Po wdrożeniu: gracz dołącza skanując QR z ekranu MG; po zdobyciu pola (także bez nagrody) ma odczuwalną satysfakcję; MG może usunąć stare sesje i nie zaśmieca sobie ekranu — przy zachowanym dołączaniu do planszy.

### Secondary
- Brak — nie wskazano nice-to-have.

### Guardrails
- Dołączanie do planszy nadal działa (w tym istniejący flow z kodem nie może się zepsuć przez QR/link).
- Usunięcie sesji nie kasuje aktywnej sesji bez świadomej akcji MG.

## User Stories

### US-01: Gracz dołącza QR i zdobywa nagrodę za liczbę pól

- **Given** MG ma otwartą sesję z kodem QR na ekranie, a na planszy obowiązują nagrody za ogólną liczbę zdobytych pól oraz (nadal) nagrody za konkretne pola
- **When** gracz skanuje QR, dołącza i oznacza kolejne pola
- **Then** dołącza bez wpisywania adresu i kodu, czuje satysfakcję przy zdobyciu pola, a po osiągnięciu progu liczby pól dostaje nagrodę „za liczbę”; nagrody za konkretne pole nadal działają

### US-02: MG usuwa starą sesję

- **Given** MG widzi listę sesji, w tym starą
- **When** wybiera usunięcie i potwierdza
- **Then** sesja znika z listy (także niezależnie od statusu); bez potwierdzenia nic się nie kasuje

## Scope of Change

### Dołączanie
- [new] Gracz może dołączyć do planszy za pomocą kodu QR. Priority: must-have
  > Socrates: Brak kontrargumentu; stoi jak jest.
- [preserved] Gracz może dołączyć do planszy wpisanym kodem. Priority: must-have
  > Socrates: Brak kontrargumentu; stoi jak jest.

### Sesje
- [new] MG może usunąć sesję niezależnie od statusu, po potwierdzeniu. Priority: must-have
  > Socrates: Brak kontrargumentu; stoi jak jest.

### Nagrody
- [new] Gracz może zdobywać nagrody za ogólną liczbę zdobytych pól oraz za układy (np. cały wiersz/kolumna), nie tylko za konkretne pole. Priority: must-have
  > Socrates: Kontrargument rozważony: "progi za liczbę zabijają lekkość bingo — za dużo księgowości."
  > Rozstrzygnięcie: zostaje must-have; progi mają być proste (np. jeden czytelny próg), żeby nie robić księgowości.
- [preserved] Gracz może zdobywać nagrody przypisane do konkretnego pola. Priority: must-have
  > Socrates: Brak kontrargumentu; stoi jak jest.

## Constraints & Compatibility

- Dołączanie wpisanym kodem musi pozostać nienaruszone.
- Istniejące sesje / plansze po wdrożeniu nadal działają.
- Nagrody za konkretne pole bez regresji.
- Nowe zachowanie nagród jest opcjonalne; istniejące sesje nie są zmuszane do nowych reguł i mogą ich nie mieć.
- Kompatybilność wstecz: stary flow dołączania oraz stare sesje muszą działać jak dziś.
- Dołączenie przez QR nie jest zauważalnie wolniejsze niż wpisanie kodu.
- Brak regresji: istniejący stół przechodzi dołączenie kodem jak dziś.
- Brak szczególnych ograniczeń okna deploy / CI dla tego slice'a.

## Business Logic Changes

System obecnie tworzy planszę bingo z nagrodami.

Ta zmiana modyfikuje regułę nagród: obok nagród za konkretne pole pojawia się nowy sposób zdobywania nagród — za ogólną liczbę zdobytych pól, za cały wiersz/kolumnę itp. Nowe zachowanie jest opcjonalne; stare sesje mogą go nie mieć.

## Access Control Changes

No access control changes — current model preserved.

| Rola | Wejście | Może (dziś) |
| --- | --- | --- |
| Mistrz Gry (MG) | konto | tworzyć planszę bingo |
| Gracz | bez konta; dołączenie do planszy | zaznaczać pola |

Brak nowych ról i brak przesunięć granic ról w tej zmianie.

## Non-Goals

Funkcjonalne:
- Brak kont dla graczy i historii między sesjami — poza zakresem tej zmiany.
- Brak wymuszania nowych nagród / progów na starych sesjach — nowe zachowanie opcjonalne.
- Brak natywnej aplikacji mobilnej — QR w przeglądarce wystarczy.

## Open Questions

Brak. Pytania o cel systemu, architekturę i stack uzupełnione 2026-10-14 w Current System Overview z `prd.md` (v1) i `tech-stack.md`.
