---
project: "RPG Bingo"
context_type: greenfield
created: 2026-09-18
updated: 2026-09-18
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "primary persona"
      decision: "Mistrz Gry jako persona główna; Gracz jako persona drugorzędna"
    - topic: "pain category"
      decision: "brakująca możliwość — brak mechanizmu meta-wyzwań i lekkiej rywalizacji przy stole"
    - topic: "auth strategy — MG"
      decision: "konto z logowaniem; rejestracja otwarta"
    - topic: "auth strategy — gracz"
      decision: "bez konta; kod sesji + nick, tożsamość tylko w obrębie sesji"
    - topic: "admin role"
      decision: "osobna rola admin (właściciel instancji) utrzymuje bazę predefiniowanych haseł"
    - topic: "who marks a field"
      decision: "gracz oznacza sam po słownym potwierdzeniu MG; MG może cofnąć oznaczenie"
    - topic: "MVP timeline"
      decision: "3 tygodnie pracy po godzinach; pierwszy przepływ bez live sync (odświeżanie)"
    - topic: "business logic rule"
      decision: "losowe składanie planszy N×N z puli haseł i nagród; nagrody widoczne od początku; pole należy do pierwszego, który oznaczył"
    - topic: "admin screen in MVP"
      decision: "brak — baza haseł i lista nagród ładowane jako seed przy wdrożeniu (FR-016 nice-to-have)"
    - topic: "product framing"
      decision: "web-app; skala small; twardy termin 2026-11-04; po godzinach"
  frs_drafted: 17
  quality_check_status: accepted
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-11-04
  after_hours_only: true
---

# Shape notes

## Seed idea

> Aplikacja webowa dla stołów papierowych RPG: MG tworzy sesję, plansza bingo losuje się z bazy haseł (wbudowanych i własnych), gracze dołączają z telefonów i widzą wspólną planszę; pole zajęte przez jednego gracza jest niedostępne dla innych, MG potwierdza słownie; zajęte pola/linie dają bonusy (inspiracja, przedmiot, zadanie poboczne). Pierwsza wersja bez synchronizacji na żywo (odświeżanie). Do rozstrzygnięcia: czy gracze mają konta czy dołączają kodem, kto odznacza pole (gracz czy MG), jak definiowane są bonusy.
>
> Opcjonalne, poza opisem: live sync przez WebSocket, statystyki między sesjami.

## Vision & Problem Statement

Mistrz Gry prowadzący sesję papierowego RPG (np. D&D) chce, żeby gracze w trakcie sesji wychodzili poza rutynę — odgrywali sceny, podejmowali ryzyko, zwracali uwagę na rzeczy, które normalnie by pominęli — i żeby nagrody typu inspiracja wynikały z czytelnej reguły, a nie z uznaniowej decyzji MG. Dziś przy stole nie ma mechanizmu, który wprowadzałby dodatkowe meta-wyzwania i lekką rywalizację w drużynie, która normalnie gra wspólnie. Uznaniowe przyznawanie inspiracji jest problematyczne: gracz może czuć się pominięty albo uważać, że ktoś dostał nagrodę niesłusznie. Próba zrobienia tego zwykłym generatorem bingo wymaga ręcznego układania haseł od zera przed każdą sesją.

Insight: predefiniowana, utrzymywana przez administratora systemu baza haseł specyficznych dla RPG, uzupełniana o własne hasła dobrane pod konkretną grę, sprawia, że plansza powstaje w chwilę. Wspólna plansza dla całej sesji z zasadą "pole zajęte raz" zamienia bingo z solo-zabawy w mechanikę drużynową z lekką rywalizacją; powiązanie nagrody z konkretnym, widocznym dla wszystkich polem usuwa uznaniowość. Możliwe są też nagrody drużynowe za zajęcie odpowiednich pól.

Kategoria bólu: brakująca możliwość.

Uwaga ze sondy skali: produkt jest budowany dla własnego stołu i garści znajomych; przy stukrotnie większej skali (setki równoległych sesji) krótki, kilkuznakowy kod sesji musiałby stać się dłuższy lub bezpieczniejszy, bo przestrzeń kodów byłaby zbyt gęsta.

## User & Persona

**Persona główna: Mistrz Gry (MG).** Prowadzi sesje papierowego RPG dla stałej drużyny. Wprowadza narzędzie do stołu, tworzy sesję i planszę, w trakcie gry słownie potwierdza graczom, że mogą oznaczyć pole, i korzysta z mechanizmu nagród zamiast przyznawać je uznaniowo. Sięga po produkt przed sesją (przygotowanie planszy) i w jej trakcie (potwierdzanie pól, przyznawanie bonusów).

### Secondary persona

**Gracz.** Członek drużyny. Dołącza z telefonu, widzi wspólną planszę i to, co jest jeszcze do zdobycia, oznacza zdobyte pola po potwierdzeniu MG i odbiera bonusy. Odbiorca wyzwań, nagród i lekkiej rywalizacji.

Trzecia rola: **administrator systemu**, który utrzymuje bazę predefiniowanych haseł (szczegóły w Access Control).

## Access Control

Model wieloużytkownikowy z trzema rolami.

| Rola | Wejście do aplikacji | Może |
| --- | --- | --- |
| Administrator | konto z rolą admin (właściciel instancji) | utrzymywać bazę predefiniowanych haseł (ekran administracyjny poza MVP — FR-016 nice-to-have; w MVP baza ładowana przy wdrożeniu); wszystko, co MG |
| Mistrz Gry | konto, logowanie; rejestracja otwarta (każdy może założyć konto) | tworzyć sesje i plansze; dodawać własne hasła do swoich gier; korzystać z bazy predefiniowanej bez prawa jej edycji; cofać błędne oznaczenie pola; przyznawać i widzieć bonusy |
| Gracz | bez konta; kod sesji + wpisany nick; tożsamość żyje tylko w obrębie sesji | widzieć wspólną planszę; oznaczać pole po słownym potwierdzeniu MG; widzieć swoje bonusy |

- Potwierdzenie zdobycia pola odbywa się słownie przy stole; w aplikacji oznaczenie wykonuje gracz. MG może cofnąć błędne oznaczenie.
- Niezalogowany użytkownik na trasie MG lub administratora trafia na ekran logowania.
- Osoba bez ważnego kodu sesji nie widzi planszy.

## MVP flow (first session, click by click)

1. MG otwiera aplikację i loguje się (lub jest już zalogowany).
2. MG ustawia parametry nowego bingo: rozmiar planszy (domyślnie 5x5), własne hasła, dostępne nagrody i ich liczbę.
3. MG klika "wygeneruj" — system losuje planszę z bazy haseł (predefiniowane + własne) i zwraca planszę oraz krótki kod sesji (kilka znaków).
4. MG podaje kod graczom przy stole.
5. Gracz wpisuje kod + nick w aplikacji na telefonie — bez logowania.
6. Wszyscy widzą tę samą planszę.
7. Gracz wykonuje zadanie z kafelka, MG uznaje słownie, gracz klika kafelek — kafelek oznacza się jego kolorem/nickiem i staje się niedostępny dla innych.
8. Gracz od razu widzi informację o nagrodzie.
9. Gdy pola się skończą (lub MG chce), MG generuje nową planszę z nowym kodem.

Pierwsza wersja bez synchronizacji na żywo — plansza odświeża się po akcji lub okresowo.

## Success Criteria

### Primary
- Jedna prawdziwa sesja przy stole przechodzi cały przepływ MVP: MG generuje planszę (5x5, własne hasła, nagrody), gracze wchodzą kodem z telefonów, co najmniej jeden gracz oznacza pole po słownym potwierdzeniu MG i widzi nagrodę, a pozostali po odświeżeniu widzą pole jako zajęte.

### Secondary
- Drużyna zdobywa nagrodę drużynową (linię/układ pól) w trakcie sesji.

### Guardrails
- Nigdy dwóch graczy nie posiada tego samego pola — nawet gdy klikną niemal równocześnie.
- Plansza jest czytelna i klikalna na telefonie przy stole, bez powiększania.
- Stan planszy przetrwa odświeżenie strony, zerwanie sieci i ponowne wejście kodem.

## User Stories

### US-01: Gracz zdobywa pole i nagrodę

- **Given** gracz dołączył do aktywnej sesji kodem i nickiem, a na planszy jest wolne pole
- **When** MG słownie uznaje wykonanie zadania z tego pola i gracz klika kafelek
- **Then** kafelek oznacza się kolorem/nickiem gracza, staje się niedostępny dla innych, a gracz natychmiast widzi, czy zdobył nagrodę

#### Acceptance Criteria
- Drugi gracz klikający to samo pole chwilę później widzi, że pole jest już zajęte i przez kogo; jego kliknięcie nie zmienia stanu.
- Pole bez nagrody też daje graczowi wyraźne potwierdzenie zajęcia (bez fałszywego "brak nagrody" jako błędu).
- Po odświeżeniu u każdego uczestnika sesji pole jest widoczne jako zajęte przez tego gracza.
- MG widzi, kto zdobył którą nagrodę, żeby mógł ją wręczyć w fikcji gry.

## Functional Requirements

### Konta i dostęp
- FR-001: MG może założyć konto i zalogować się. Priority: must-have
  > Socrates: Kontrargument rozważony: "konto to tarcie przed pierwszą sesją; MG odpuści, zanim zobaczy wartość." Rozstrzygnięcie: zostaje must-have; tarcie łagodzi FR-003 jako nice-to-have.
- FR-002: Gracz może dołączyć do sesji kodem i nickiem, bez konta. Priority: must-have
  > Socrates: Kontrargument rozważony: "bez konta nie ma historii gracza, co blokuje statystyki i nagrody drużynowe między sesjami." Rozstrzygnięcie: zostaje; statystyki między sesjami są poza MVP (kandydat na non-goal).
- FR-003: MG może stworzyć planszę bingo przed rejestracją; logowanie jest wymagane dopiero, gdy plansza ma się wyświetlić. Priority: nice-to-have
  > Socrates: Kontrargument rozważony: "utrzymywanie niezapisanego stanu planszy przez ekran logowania to złożoność za małą korzyść." Rozstrzygnięcie: zostaje nice-to-have.

### Tworzenie sesji i planszy
- FR-004: MG może utworzyć sesję bingo z parametrami: rozmiar planszy (domyślnie 5x5), własne hasła, dostępne nagrody i ich liczba. Priority: must-have
  > Socrates: Kontrargument rozważony: "trzy grupy parametrów przed pierwszą grą to za dużo." Rozstrzygnięcie: zostaje; wszystkie parametry mają sensowne wartości domyślne, więc MG może kliknąć "generuj" od razu.
- FR-005: MG może wygenerować planszę — system losuje hasła z bazy predefiniowanej i własnych. Priority: must-have
  > Socrates: Kontrargument rozważony: "losowe hasła mogą nie pasować do systemu/kampanii — baza potrzebuje kategorii lub filtrów." Rozstrzygnięcie: zostaje jak jest; filtrowanie wydzielone jako FR-017 (nice-to-have).
- FR-006: MG otrzymuje krótki kod sesji. Priority: must-have
  > Socrates: Kontrargument rozważony: "krótki kod jest zgadywalny; ktoś spoza stołu może wejść i pooznaczać pola." Rozstrzygnięcie: zostaje; odporność kodu na zgadywanie zapisana jako kandydat na NFR (faza 5).
- FR-007: MG może wygenerować nową planszę (nowy kod); gracze muszą do niej dołączyć na nowo. Priority: must-have
  > Socrates: Kontrargument rozważony: "ponowne wpisywanie kodu i nicku w środku sesji irytuje; sesja mogłaby mieć wiele plansz pod jednym kodem." Rozstrzygnięcie: zostaje jak jest; ponowne dołączanie świadomie zaakceptowane w MVP.

### Rozgrywka
- FR-008: Gracz może zobaczyć wspólną planszę z aktualnym stanem pól (kto zajął które). Priority: must-have
  > Socrates: Brak kontrargumentu; stoi jak jest.
- FR-009: Gracz może oznaczyć wolne pole jako zdobyte przez siebie. Priority: must-have
  > Socrates: Kontrargument rozważony: "gracz oznaczy pole bez słownej zgody MG — aplikacja nie ma jak tego wykryć." Rozstrzygnięcie: zostaje; uczciwość należy do stołu, MG ma FR-012 do korekty.
- FR-010: Gracz widzi, które pola oferują nagrodę i jaką. Priority: must-have
  > Socrates: Brak kontrargumentu; stoi jak jest. Doprecyzowane w fazie 5: rodzaj nagrody jest widoczny od początku, nie dopiero po zajęciu.
- FR-011: Gracz widzi, że zdobył nagrodę natychmiast po oznaczeniu pola. Priority: must-have
  > Socrates: Brak kontrargumentu; stoi jak jest.
- FR-012: MG może cofnąć błędne oznaczenie pola; cofnięcie zwalnia pole i unieważnia powiązaną nagrodę. Priority: must-have
  > Socrates: Kontrargument rozważony: "cofnięcie musi też cofnąć nagrodę i ewentualną linię drużynową — ukryta złożoność." Rozstrzygnięcie: FR doprecyzowany o zwolnienie pola i unieważnienie nagrody.
- FR-013: Gracze i MG widzą aktualną planszę bez zbędnych opóźnień. Priority: nice-to-have
  > Socrates: Kontrargument rozważony: "'bez zbędnych opóźnień' jest niemierzalne." Rozstrzygnięcie: zostaje jak jest.

### Nagrody
- FR-014: Gracze mogą zdobyć nagrody drużynowe. Priority: nice-to-have
  > Socrates: Kontrargument rozważony: "wymaga zdefiniowania 'układu' (linia? cała plansza?) — bez tego FR jest pusty." Rozstrzygnięcie: zostaje jak jest; definicja układu trafia do Open Questions.
- FR-015: MG może definiować własne nagrody. Priority: nice-to-have
  > Socrates: Kontrargument rozważony: "to tylko etykiety tekstowe, odkładanie nic nie daje." Rozstrzygnięcie: zostaje nice-to-have.

### Administracja
- FR-016: Administrator może zarządzać bazą predefiniowanych haseł. Priority: nice-to-have
  > Socrates: Kontrargument rozważony: "ekran administracyjny w MVP to praca dla jednej osoby; seed przy wdrożeniu załatwi to taniej." Rozstrzygnięcie: spada do nice-to-have; w MVP baza haseł ładowana przy wdrożeniu.
- FR-017: MG może filtrować bazę predefiniowanych haseł po kategorii/systemie gry przy generowaniu planszy. Priority: nice-to-have
  > Socrates: Wydzielony z kontrargumentu do FR-005; brak osobnego kontrargumentu.

## Non-Functional Requirements

- Osoba spoza stołu zgadująca kody sesji nie trafi w aktywną sesję w rozsądnym czasie (< 1 trafienie na 100 000 prób).
- Zmiana stanu pola jest widoczna u pozostałych uczestników sesji najpóźniej po 10 s, bez ręcznego odświeżania.
- Plansza 5x5 jest czytelna i klikalna na ekranie telefonu ~6" w orientacji pionowej, bez powiększania i przewijania.
- Sesja i stan planszy są dostępne kodem przez cały wieczór gry (≥ 8 h od utworzenia), niezależnie od odświeżeń strony i zerwań sieci.
- Produkt działa w aktualnych wersjach przeglądarek mobilnych na iOS i Android bez instalowania aplikacji.

## Business Logic

Z puli haseł (predefiniowanych i własnych MG) oraz puli nagród (wprowadzonych jako seed przez administratora, wybranych przez MG wraz z liczbą) aplikacja losowo składa planszę N×N i decyduje, które pola niosą którą nagrodę.

Wejścia, które podaje MG: rozmiar planszy (domyślnie 5x5), własne hasła dopisane pod tę grę, wybór dostępnych nagród z listy i ich liczba. Wyjście: plansza N×N z unikalnymi hasłami i losowo rozmieszczonymi nagrodami. Gracze od początku widzą, które pola mają nagrodę i jaką (FR-010); po zajęciu pola gracz natychmiast widzi, że ją zdobył (FR-011).

Reguła towarzysząca — zajmowanie pól: pole należy do pierwszego gracza, który je oznaczył, i tylko jemu przypisana zostaje nagroda z tego pola; kolejne kliknięcia innych graczy nie zmieniają stanu. Cofnięcie oznaczenia przez MG zwalnia pole i unieważnia powiązaną nagrodę (FR-012). W MVP nagrody pochodzą z ustalonej listy seed (np. inspiracja, przedmiot, zadanie poboczne); własne nagrody MG to FR-015 (nice-to-have).

## Non-Goals

Funkcjonalne:
- Brak statystyk i historii gracza między sesjami — gracz nie ma tożsamości poza jedną sesją; wynika wprost z FR-002 (bez konta).
- Aplikacja nie weryfikuje wykonania zadania — nie integruje się z rzutami kości, VTT ani kartami postaci; uznanie należy do MG przy stole.
- Brak współdzielenia własnych haseł między MG i brak publicznej biblioteki haseł społeczności — jedno źródło predefiniowane (seed) plus prywatne hasła MG.
- Brak współprowadzenia — jedna sesja ma jednego MG.

Niefunkcjonalne:
- Brak synchronizacji na żywo (push) — wystarcza widoczność zmiany stanu do 10 s (NFR); FR-013 pozostaje nice-to-have poza MVP.
- Brak trybu offline — przy stole wymagane jest połączenie z siecią.
- Brak pełnej zgodności z WCAG AA w MVP.
- Brak wielojęzyczności — interfejs i baza haseł w jednym języku.

## Open Questions

1. **Jak zdefiniowany jest "układ" dający nagrodę drużynową (FR-014)?** — pełna linia (wiersz/kolumna/przekątna) przez dowolnych graczy, cała plansza, inny wzór? Owner: użytkownik. Block: nie (FR nice-to-have).
2. **Co dzieje się, gdy haseł (predefiniowane + własne) jest mniej niż pól na wybranej planszy?** — Założenie MVP: baza seed jest zawsze większa niż 25 haseł, więc przypadek nie występuje przy domyślnym 5x5. Do rozstrzygnięcia dla większych plansz. Owner: użytkownik. Block: nie.

## Quality cross-check

Status: accepted — wszystkie elementy bramki obecne (Access Control, Business Logic jako jedno zdanie, artefakty, timeline ≤ 3 tygodnie, Non-Goals). Brak luk do przeniesienia do Open Questions.

## Forward: technical-roadmap

Notatki informacyjne dla kolejnych kroków łańcucha; nie są częścią PRD.

- W MVP nie ma ekranu administratora (FR-016 nice-to-have): baza predefiniowanych haseł i lista nagród są ładowane przy wdrożeniu jako seed.
- Pierwsza wersja bez synchronizacji push; NFR "widoczność zmiany ≤ 10 s" ma być spełnione bez niej. Live sync to kandydat na etap po MVP (FR-013).
- Seed z pierwotnego pomysłu poza MVP: statystyki między sesjami (obecnie non-goal).

