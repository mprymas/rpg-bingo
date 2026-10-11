---
project: "RPG Bingo"
context_type: brownfield
created: 2026-10-11
updated: 2026-10-11
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "change category / scope"
      decision: "trzy significant features w jednej sesji shape: (A) usuwanie sesji przez MG, (B) sens/cel pól bez nagrody, (C) ułatwienie dołączania np. QR"
    - topic: "insight"
      decision: "braki zauważone po rozegraniu faktycznej sesji z innymi graczami"
    - topic: "primary persona"
      decision: "Mistrz Gry"
    - topic: "must preserve"
      decision: "dołączanie do planszy"
    - topic: "auth model"
      decision: "bez zmian — MG z kontem, gracze bez konta; brak nowych ról i przesunięć granic"
    - topic: "blast radius"
      decision: "dołączanie kodem; pomyłkowe usunięcie aktywnej sesji"
    - topic: "MVP timeline"
      decision: "≤ 3 tygodnie po godzinach"
    - topic: "secondary success"
      decision: "brak — użytkownik nie wskazał nice-to-have"
    - topic: "primary user stories"
      decision: "US-01 QR+nagrody; US-02 usuwanie sesji"
    - topic: "business logic"
      decision: "modyfikacja reguły nagród — liczba pól / wiersz-kolumna obok nagród per-pole; opcjonalne dla starych sesji"
    - topic: "constraints"
      decision: "kod join, istniejące sesje, nagrody per-pole; brak migracji wymuszającej nowe zachowanie; backward compatible"
    - topic: "product_type"
      decision: "No change — existing web-app"
    - topic: "target_scale"
      decision: "No change — small (własny stół / garść znajomych)"
    - topic: "timing"
      decision: "brak twardego deadline; po godzinach; delivery_weeks=3"
    - topic: "non-goals"
      decision: "bez kont graczy/historii między sesjami; bez wymuszania nowych nagród na starych sesjach; bez natywnej apki mobilnej"
    - topic: "system constraints"
      decision: "brak szczególnych ograniczeń deploy/CI dla tego slice'a"
  frs_drafted: 5
  quality_check_status: accepted
product_type: web-app
target_scale:
  users: small
timeline_budget:
  delivery_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

# Shape notes

## Seed idea

> usuwanie sesji przez MG

## Current System

MG może utworzyć planszę; gracze mogą dołączyć i oznaczać pola. Dołączenie wymaga wpisania adresu aplikacji, a potem kodu sesji. Nie ma usuwania starych sesji przez MG. Pola bez nagrody nie dają graczom wyraźnego celu.

## Vision & Problem Statement

Po rozegraniu faktycznej sesji z innymi graczami wyszły trzy braki w istniejącym produkcie:

1. MG nie może usuwać starych sesji — lista / historia się zapycha, a niepotrzebne sesje zostają.
2. Pola bez nagrody nie mają dla graczy wyraźnego celu.
3. Dołączenie wymaga wpisania adresu aplikacji i kodu — przy stole to tarcie; potrzebne ułatwienie, np. kod QR.

Kategoria zmiany: significant features (trzy w jednym kształcie). Insight: problemy ujawnione dopiero przy realnej grze, nie na papierze.

Must preserve: dołączanie do planszy nadal działa (istniejący flow nie może się zepsuć).

## User & Persona

**Persona główna: Mistrz Gry (MG).** Prowadzi sesję, tworzy planszę, zarządza stołem. Sięga po te zmiany, żeby posprzątać stare sesje, mieć sensowną planszę dla graczy (także poza nagrodami) i szybciej wprowadzić drużynę na planszę (np. QR zamiast dyktowania adresu i kodu).

## Access Control

No changes planned — current model preserved.

| Rola | Wejście | Może (dziś) |
| --- | --- | --- |
| Mistrz Gry (MG) | konto | tworzyć planszę bingo |
| Gracz | bez konta; dołączenie do planszy | zaznaczać pola |

Brak nowych ról i brak przesunięć granic ról w tej zmianie.

## MVP delta (user experience after change)

1. MG ma na ekranie kod QR do sesji/planszy.
2. Gracz skanuje QR i dołącza łatwiej niż przez wpisywanie adresu + kodu.
3. Gracz czuje satysfakcję z każdego zdobytego pola (nie tylko z nagrodą).
4. MG może usunąć stare sesje — ekran nie jest zaśmiecony.

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

## Functional Requirements

### Dołączanie
- FR-001: Gracz może dołączyć do planszy za pomocą kodu QR. Priority: must-have. Change: new
  > Socrates: Brak kontrargumentu; stoi jak jest.
- FR-002: Gracz może dołączyć do planszy wpisanym kodem. Priority: must-have. Change: preserved
  > Socrates: Brak kontrargumentu; stoi jak jest.

### Sesje
- FR-003: MG może usunąć sesję niezależnie od statusu, po potwierdzeniu. Priority: must-have. Change: new
  > Socrates: Brak kontrargumentu; stoi jak jest.

### Nagrody
- FR-004: Gracz może zdobywać nagrody za ogólną liczbę zdobytych pól oraz za układy (np. cały wiersz/kolumna), nie tylko za konkretne pole. Priority: must-have. Change: new
  > Socrates: Kontrargument rozważony: "progi za liczbę zabijają lekkość bingo — za dużo księgowości."
  > Rozstrzygnięcie: zostaje must-have; progi mają być proste (np. jeden czytelny próg), żeby nie robić księgowości.
- FR-005: Gracz może zdobywać nagrody przypisane do konkretnego pola. Priority: must-have. Change: preserved
  > Socrates: Brak kontrargumentu; stoi jak jest.

## Business Logic

System obecnie tworzy planszę bingo z nagrodami.

Ta zmiana modyfikuje regułę nagród: obok nagród za konkretne pole pojawia się nowy sposób zdobywania nagród — za ogólną liczbę zdobytych pól, za cały wiersz/kolumnę itp. Nowe zachowanie jest opcjonalne; stare sesje mogą go nie mieć.

## Constraints & Preserved Behavior

- Dołączanie wpisanym kodem musi pozostać nienaruszone.
- Istniejące sesje / plansze po wdrożeniu nadal działają.
- Nagrody za konkretne pole bez regresji.
- Migracja: nie — nowe zachowanie opcjonalne; stare sesje mogą go nie mieć.
- Kompatybilność wstecz: stary flow dołączania oraz stare sesje muszą działać jak dziś.
- Brak szczególnych ograniczeń okna deploy / CI dla tego slice'a.

## Non-Functional Requirements

- Dołączenie przez QR nie jest zauważalnie wolniejsze niż wpisanie kodu.
- Brak regresji: istniejący stół przechodzi dołączenie kodem jak dziś.

## Non-Goals

Funkcjonalne:
- Brak kont dla graczy i historii między sesjami — poza zakresem tej zmiany.
- Brak wymuszania nowych nagród / progów na starych sesjach — nowe zachowanie opcjonalne.
- Brak natywnej aplikacji mobilnej — QR w przeglądarce wystarczy.

## Quality cross-check

Status: accepted — Access Control, Business Logic, artefakty, timeline ≤ 3 tygodnie, Non-Goals, Preserved behavior — obecne. Brak luk.
