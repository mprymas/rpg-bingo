# Evidence: language in the documents

Pytanie: które słowa, cykle życia i reguły stwierdza biznes. Raport po polsku. Terminy i cytaty zostają w języku źródła. Etykiety: **evidence** (zdanie jest w cytowanym miejscu), **inference** (wniosek z dwóch cytatów, oznaczony), **unknown** (w przeszukanym zakresie brak rozstrzygnięcia).

## Co przeczytane

Wymagania, w całości:

- `context/foundation/prd.md` (utworzony 2026-09-18, status draft; ostatni commit pliku 2026-10-03, `f222ffc`)
- `context/foundation/prd-v2.md` (utworzony 2026-10-11, status draft; ostatni commit 2026-10-14, `3a311f2`)

Narracja w całości (14 plików):

1. `context/foundation/shape-notes.md` (2026-10-11, wizja zmiany v2)
2. `context/foundation/archive/shape-notes-2026-10-11-1304.md` (frontmatter updated 2026-09-18; plik zarchiwizowany commitem 2026-10-11, `6b93312`)
3. `context/foundation/roadmap.md` (created 2026-10-11, updated 2026-10-14)
4. `context/archive/2026-10-11-threshold-pattern-rewards/plan-brief.md`
5. `context/archive/2026-10-11-player-join-via-qr/plan-brief.md`
6. `context/archive/2026-10-11-gm-regenerate-board/plan-brief.md`
7. `context/archive/2026-10-11-gm-delete-session/plan-brief.md`
8. `context/archive/2026-10-03-player-claim-field-reward/plan-brief.md`
9. `context/archive/2026-10-03-gm-undo-field-claim/plan-brief.md`
10. `context/archive/2026-10-03-player-join-shared-board/plan-brief.md`
11. `context/archive/2026-09-27-gm-create-session-board/plan-brief.md`
12. `context/archive/2026-09-27-seed-phrase-reward-catalog/plan-brief.md`
13. `context/archive/2026-10-14-gm-tile-reward-typography/plan-brief.md`
14. `context/archive/2026-10-07-testing-abuse-join-identity/plan-brief.md`

Narracja częściowo (nie liczone jako pełne czytanie):

- `context/archive/2026-10-11-gm-regenerate-board/plan.md` linie 1–39 (overview; plan mówi, że zmiękcza FR-007)
- `context/archive/2026-10-03-player-claim-field-reward/plan.md` linie 407–421 (Addendum A, kolory 1–8)
- notatki w `change.md`: create-session (decision summary), threshold-pattern-rewards, gm-tile-reward-typography

Tytuły wszystkich 22 `change.md` (frontmatter `title:`; pierwszy nagłówek markdown w każdym to `## Notes`, linia 10):

| ścieżka | title |
| --- | --- |
| `context/archive/2026-09-27-gm-create-session-board/change.md:3` | Gm create session board |
| `context/archive/2026-09-27-seed-phrase-reward-catalog/change.md:3` | Seed phrase reward catalog |
| `context/archive/2026-09-30-ui-new-session-board/change.md:3` | Audyt i poprawa widoku tworzenia planszy bingo |
| `context/archive/2026-10-01-signed-in-landing/change.md:3` | Signed in landing |
| `context/archive/2026-10-01-ui-auth-signin/change.md:3` | Audyt i poprawa widoku logowania |
| `context/archive/2026-10-01-ui-mg-dashboard/change.md:3` | Audyt i poprawa panelu MG (dashboard) |
| `context/archive/2026-10-01-ui-session-board/change.md:3` | Audyt i poprawa widoku wygenerowanej planszy bingo |
| `context/archive/2026-10-02-ui-auth-confirm-email/change.md:3` | Audyt i poprawa widoku potwierdzenia e-mail |
| `context/archive/2026-10-02-ui-auth-signup/change.md:3` | Audyt i poprawa widoku rejestracji |
| `context/archive/2026-10-03-gm-undo-field-claim/change.md:3` | Gm undo field claim |
| `context/archive/2026-10-03-player-claim-field-reward/change.md:3` | Player claim field reward |
| `context/archive/2026-10-03-player-join-shared-board/change.md:3` | Player join shared board |
| `context/archive/2026-10-06-testing-runner-bootstrap-board-integrity/change.md:3` | Runner bootstrap + board integrity |
| `context/archive/2026-10-07-configure-sentry/change.md:3` | Configure Sentry |
| `context/archive/2026-10-07-report-error-helper/change.md:3` | Shared reportError helper for API/SSR Worker logs |
| `context/archive/2026-10-07-testing-abuse-join-identity/change.md:3` | Abuse & join identity test coverage |
| `context/archive/2026-10-07-testing-play-path-claim-undo/change.md:3` | Play-path claim & undo test coverage |
| `context/archive/2026-10-11-gm-delete-session/change.md:3` | MG usuwa sesję po potwierdzeniu |
| `context/archive/2026-10-11-gm-regenerate-board/change.md:3` | MG regenerates board with new code; players auto-rejoin |
| `context/archive/2026-10-11-player-join-via-qr/change.md:3` | Player joins by scanning QR on the GM board |
| `context/archive/2026-10-11-threshold-pattern-rewards/change.md:3` | Rewards for claimed-field count and completed rows/columns |
| `context/archive/2026-10-14-gm-tile-reward-typography/change.md:3` | Fix MG tile reward font size and ellipsis |

Tylko tytuł, bez czytania treści: pozostałe `plan.md`, `research.md`, `reviews/impl-review.md` oraz briefy UI (auth, dashboard, landing, widoki planszy), `configure-sentry`, `report-error-helper`, `testing-play-path-claim-undo`, `testing-runner-bootstrap-board-integrity`. Powód: budżet ~20 pełnych plików narracji; pierwszeństwo briefów i rzeczowników biznesowych (sesja, plansza, pole, nagroda, dołączenie, próg, QR).

Referencje: `README.md` (początek — szablon startowy), `CLAUDE.md` i `AGENTS.md` (wyszukanie słów domeny), `context/ideas/phrases.md`, `context/ideas/rewards.md`, `supabase/seed.sql` linie 1–72 (tekst katalogu).

Inżynieria, tylko reguły: `context/foundation/test-plan.md` §2 (ryzyka) i §6.5–6.6 oraz data „Last updated: 2026-10-11” (linia 9). `context/foundation/lessons.md` w całości (krótki; reguły operacyjne, nie produktowe). Nagłówki bez reguł produktowych: `test-stack.md`, `tech-stack.md`, `infrastructure.md`, `context/deployment/deploy-plan.md`, `context/audits/observability/2026-10-07_auth-create-session-join-claim.md` (wzorzec na nagłówkach), `context/changes/bootstrap-verification/verification.md`.

## Terms

Jedna pozycja na termin. Cytat jest słowami źródła.

| Termin | Warianty | Rodzaj | Definicja (cytat) | Źródło | Etykieta |
| --- | --- | --- | --- | --- | --- |
| Mistrz Gry | MG; Game Master (w briefach po angielsku) | role | „Persona główna: Mistrz Gry (MG). Prowadzi sesje papierowego RPG dla stałej drużyny.” | `context/foundation/prd.md:28` | evidence |
| Gracz | player; członek drużyny | role | „Gracz. Członek drużyny. Dołącza z telefonu, widzi wspólną planszę i to, co jest jeszcze do zdobycia, oznacza zdobyte pola po potwierdzeniu MG i odbiera bonusy.” | `context/foundation/prd.md:32` | evidence |
| administrator systemu | Administrator; „właściciel instancji”; rola admin | role | „Trzecia rola: administrator systemu, który utrzymuje bazę predefiniowanych haseł” | `context/foundation/prd.md:34`; tabela `context/foundation/prd.md:131` | evidence |
| drużyna | — | thesis | „lekka rywalizacja w drużynie, która normalnie gra wspólnie” | `context/foundation/prd.md:22` | evidence |
| stół | „przy stole”; „własny stół i garść znajomych” | thesis | „Produkt jest budowany dla własnego stołu i garści znajomych” | `context/foundation/prd.md:24` | evidence |
| sesja | sesja bingo; session | entity | „MG może utworzyć sesję bingo z parametrami: rozmiar planszy (domyślnie 5x5), własne hasła, dostępne nagrody i ich liczba.” | `context/foundation/prd.md:74` | evidence |
| plansza | plansza bingo; board; wspólna plansza | entity | „Wspólna plansza dla całej sesji z zasadą "pole zajęte raz"” | `context/foundation/prd.md:24` | evidence |
| pole | kafelek; field; cell | entity | „kafelek oznacza się kolorem/nickiem gracza, staje się niedostępny dla innych” | `context/foundation/prd.md:55` | evidence |
| hasło | phrase; teksty katalogu | value | „system losuje hasła z bazy predefiniowanej i własnych” | `context/foundation/prd.md:76` | evidence |
| zadanie | „zadanie z tego pola” | value | „MG słownie uznaje wykonanie zadania z tego pola i gracz klika kafelek” | `context/foundation/prd.md:54` | evidence |
| baza predefiniowanych haseł | katalog; phrases; seed | entity | „Predefiniowana, utrzymywana przez administratora systemu baza haseł specyficznych dla RPG” | `context/foundation/prd.md:24` | evidence |
| własne hasła | custom phrases; „gwarantowane na planszy” | value | „Each custom phrase has a "gwarantowane na planszy" checkbox; checked ones always land on the board” | `context/archive/2026-09-27-gm-create-session-board/plan-brief.md:23` | evidence |
| nagroda | reward; „bonusy” patrz osobno | value | „powiązanie nagrody z konkretnym, widocznym dla wszystkich polem usuwa uznaniowość” | `context/foundation/prd.md:24` | evidence |
| bonus | bonusy | value | „odbiera bonusy”; w tabeli ról MG „przyznawać i widzieć bonusy” | `context/foundation/prd.md:32`; `context/foundation/prd.md:132` | evidence |
| Inspiracja | slug `inspiration` | value | „Przyznanie inspiracji dla zdobywcy pola.” | `supabase/seed.sql:42-43` | evidence |
| Przedmiot | slug `item` | value | „Drobny przedmiot fabularny lub użytkowy.” | `supabase/seed.sql:48` | evidence |
| Zadanie poboczne | slug `side-quest` | value | „Krótki wątek poboczny dla drużyny.” | `supabase/seed.sql:53` | evidence |
| Wskazówka | slug `clue` | value | „MG zdradza jedną użyteczną wskazówkę związaną z bieżącą sytuacją.” | `supabase/seed.sql:58` | evidence |
| Pomoc w walce | slug `npc-help` | value | „Wprowadzenie pomocy do następnej walki za pomocą NPC.” | `supabase/seed.sql:63` | evidence |
| Doświadczenie | slug `experience` | value | „Dodatkowe punkty doświadczenia dla zdobywcy pola.” | `supabase/seed.sql:68` | evidence |
| nagroda za konkretne pole | per-field; nagroda na polu | policy | „[preserved] Gracz może zdobywać nagrody przypisane do konkretnego pola.” | `context/foundation/prd-v2.md:88` | evidence |
| nagroda za liczbę pól | próg; threshold; „za liczbę”; N | measure | „po osiągnięciu progu liczby pól dostaje nagrodę „za liczbę”” | `context/foundation/prd-v2.md:64` | evidence |
| nagroda za wiersz/kolumnę | line; układ (w tym sensie); „Nagroda za wiersz/kolumnę” | policy | „a reward for holding N claimed fields and a reward for each completed row/column” | `context/archive/2026-10-11-threshold-pattern-rewards/plan-brief.md:7` | evidence |
| nagroda drużynowa | „linię/układ pól”; FR-014 | policy | „Drużyna zdobywa nagrodę drużynową (linię/układ pól) w trakcie sesji.” | `context/foundation/prd.md:42` | evidence |
| kod sesji | code; krótki kod; „6-character session code” | value | „MG otrzymuje krótki kod sesji.” Doprecyzowanie: „6 uppercase chars from a 32-symbol alphabet without `0/O/1/I`” | `context/foundation/prd.md:78`; `context/archive/2026-09-27-gm-create-session-board/plan-brief.md:22` | evidence |
| nick | nickname; „wpisany nick” | value | „Trimmed, 1–24 characters, duplicates allowed” | `context/archive/2026-10-03-player-join-shared-board/plan-brief.md:29` | evidence |
| kolor | color; „kolorem/nickiem” | value | „kafelek oznacza się kolorem/nickiem gracza” | `context/foundation/prd.md:55` | evidence |
| kod QR | QR | value | „Gracz może dołączyć do planszy za pomocą kodu QR.” | `context/foundation/prd-v2.md:75` | evidence |
| successor | następca sesji po regeneracji (słowo briefu: successor) | value | „the prior session becomes `closed` and points at the successor” | `context/archive/2026-10-11-gm-regenerate-board/plan.md:5` | evidence |
| active | status aktywna | state | „`status` column (`active`/`closed`), default `active`” | `context/archive/2026-09-27-gm-create-session-board/plan-brief.md:26` | evidence |
| closed | zamknięta | state | „Old board is closed and read-only.” | `context/archive/2026-10-11-gm-regenerate-board/plan-brief.md:15` | evidence |
| wolne | free | state | „na planszy jest wolne pole”; „Gracz może oznaczyć wolne pole jako zdobyte przez siebie.” | `context/foundation/prd.md:53`; `context/foundation/prd.md:86` | evidence |
| zajęte | claimed; „pole zajęte raz” | state | „pozostali po odświeżeniu widzą pole jako zajęte” | `context/foundation/prd.md:39` | evidence |
| mystery-until-claim | „rodzaj nagrody poznaje dopiero po zajęciu” | policy | „gracze — mystery-until-claim (obecność nagrody bez etykiety do zajęcia); MG nadal widzi typy nagród od początku” | `context/foundation/prd.md:89` | evidence |
| oznaczenie | claim; „oznaczyć pole”; zajęcie | operation | „w aplikacji oznaczenie wykonuje gracz” | `context/foundation/prd.md:135` | evidence |
| cofnięcie | undo | operation | „MG może cofnąć błędne oznaczenie pola; cofnięcie zwalnia pole i unieważnia powiązaną nagrodę.” | `context/foundation/prd.md:92` | evidence |
| generowanie | „wygeneruj”; losowanie planszy | operation | „MG może wygenerować planszę — system losuje hasła z bazy predefiniowanej i własnych.” | `context/foundation/prd.md:76` | evidence |
| regeneracja | regenerate; nowa plansza z nowym kodem | operation | „MG może wygenerować nową planszę (nowy kod)” | `context/foundation/prd.md:80` | evidence |
| usunięcie sesji | hard DELETE (słowo briefu) | operation | „MG może usunąć sesję niezależnie od statusu, po potwierdzeniu.” | `context/foundation/prd-v2.md:81` | evidence |
| dołączenie | join; „dołączyć kodem i nickiem” | operation | „Gracz może dołączyć do sesji kodem i nickiem, bez konta.” | `context/foundation/prd.md:68` | evidence |
| potwierdzenie słowne | uznanie MG | event | „Potwierdzenie zdobycia pola odbywa się słownie przy stole” | `context/foundation/prd.md:135` | evidence |
| uznaniowość | „uznaniowa decyzja MG”; „z uznania MG” | thesis | „nagrody typu inspiracja wynikały z czytelnej reguły, a nie z uznaniowej decyzji MG” | `context/foundation/prd.md:22` | evidence |
| satysfakcja | — | thesis | „po zdobyciu pola (także bez nagrody) ma odczuwalną satysfakcję” | `context/foundation/prd-v2.md:49` | evidence |
| seat | „another seat” w briefie testowym | role | „outsiders cannot claim as another seat or act as MG on someone else’s session” | `context/archive/2026-10-07-testing-abuse-join-identity/plan-brief.md:8` | evidence |
| zdobywca pola | claimer | role | „Przyznanie inspiracji dla zdobywcy pola.” | `supabase/seed.sql:43` | evidence |
| completer | „whoever claims the last free field of a fully claimed line” | role | „Line ownership \| Completer wins” | `context/archive/2026-10-11-threshold-pattern-rewards/plan-brief.md:21` | evidence |

Zdanie produktu, które spina te słowa (evidence, v1 i powtórzone w v2):

> „Wspólna plansza bingo na sesję papierowego RPG — hasła z bazy RPG i własne MG, pole zajęte raz, nagroda na widocznym polu — żeby inspiracja wynikała z reguły, a nie z uznania MG.” (`context/foundation/prd-v2.md:22`)

v1 mówi to szerzej w `context/foundation/prd.md:22` i `context/foundation/prd.md:24`. prd-v2 nie uchyla wizji v1; jest dokumentem zmiany (inventory i frontmatter `context_type: brownfield`).

## Lifecycles

### Sesja

Stany nazwane w dokumentach: brak → `active` → `closed` → usunięta. Osobna ścieżka: `active` → usunięta.

- Wejście w `active`: MG generuje. „default `active`, no expiry; nothing closes it in S-01” (`context/archive/2026-09-27-gm-create-session-board/plan-brief.md:26`). Evidence.
- `active` → `closed`: regeneracja. „Close the old session, mint a new one with a new code” (`context/archive/2026-10-11-gm-regenerate-board/plan-brief.md:7`). „Old session fate \| Close (`status → closed`) + `replaced_by_session_id`” (`plan-brief.md:21`). Evidence. Kto: MG, po potwierdzeniu na planszy (`plan-brief.md:24`).
- Skutek dla graczy na starym kodzie: plansza zamknięta tylko do odczytu; przy nicku z ciasteczka auto-dołączenie do następcy. „Players with a cookie nick auto-rejoin the successor within ~10s.” (`plan-brief.md:15`). „Auto-rejoin assigns a new player row/color on the successor session (old claimToken is not reused).” (`plan-brief.md:56`). Evidence.
- Zamknięta bez następcy: „Same read-only UI, no redirect” (`plan-brief.md:28`). Evidence. Kto ustawia taki stan poza regeneracją: w przeczytanych dokumentach brak operacji. Unknown.
- Usunięcie z `active` albo `closed`: „sesja znika z listy (także niezależnie od statusu); bez potwierdzenia nic się nie kasuje” (`context/foundation/prd-v2.md:70`). „Deleting an active session mid-play is intentional after confirm; no grace period.” (`context/archive/2026-10-11-gm-delete-session/plan-brief.md:66`). Evidence. Kto: właściciel sesji (MG).
- Po usunięciu gracze: „Players with a deleted code see the same 404 as an unknown code.” (`plan-brief.md:15`). Evidence.
- Czas: NFR „Sesja i stan planszy są dostępne kodem przez cały wieczór gry (≥ 8 h od utworzenia)” (`context/foundation/prd.md:114`). Brief tworzenia: brak wygasania, sam `status` (`plan-brief.md:26`). Przejścia „po 8 h” dokumenty nie opisują. Unknown.
- Ponowne otwarcie `closed`: w przeczytanych plikach brak. Unknown.

Starsza reguła v1 o nowej planszy zostaje w wymaganiach i jest zmiękczona później — patrz konflikty. „gracze muszą do niej dołączyć na nowo” (`context/foundation/prd.md:80`).

### Pole

- Wolne → zajęte: gracz klika po słownym uznaniu MG. „pole należy do pierwszego gracza, który je oznaczył” (`context/foundation/prd.md:123`). „nawet gdy klikną niemal równocześnie” (`context/foundation/prd.md:45`). Evidence.
- Zajęte → wolne: MG cofa na sesji `active`. „Undo frees the cell and voids the claimer’s reward grant by clearing occupancy while leaving the cell’s reward slot in place” (`context/archive/2026-10-03-gm-undo-field-claim/plan-brief.md:7`). „the same reward can be won again on that cell” (`plan-brief.md:15`). Evidence.
- Już wolne przy cofnięciu: „Idempotent success” (`plan-brief.md:25`). Evidence.
- Cofnięcie na `closed`: „Closed sessions cannot undo” (`plan-brief.md:70`). Oznaczenie na starym kodzie po regeneracji: „claim on old → denied” (`context/foundation/test-plan.md:201`). Evidence.
- Cofnięcie z inicjatywy gracza: brief ma to poza zakresem („player-initiated undo”, `plan-brief.md:41`). Reguły „gracz nigdy nie cofa” dokumenty nie formułują jako zakazu produktu. Unknown poza tym wyłączeniem zakresu.

### Nagroda na polu

- Przed zajęciem gracz widzi obecność, nie rodzaj; MG widzi rodzaj od początku (`context/foundation/prd.md:89`, `context/foundation/prd.md:121`). Evidence. Data poprawki FR-010: commit 2026-10-03.
- Po zajęciu: „gracz natychmiast widzi, że ją zdobył” (`context/foundation/prd.md:121`). Pole bez nagrody: „wyraźne potwierdzenie zajęcia (bez fałszywego "brak nagrody" jako błędu)” (`context/foundation/prd.md:59`). Evidence.
- Cofnięcie unieważnia przyznanie i zostawia slot (`undo` plan-brief, wyżej). Po cofnięciu widok gracza wraca do mystery (`undo` plan-brief linia 15; test-plan `context/foundation/test-plan.md:190`). Evidence.
- Kto dostaje nagrodę z pola: „tylko jemu przypisana zostaje nagroda z tego pola” (`context/foundation/prd.md:123`). Evidence.

### Nagroda za próg i za wiersz/kolumnę

Włączana przy tworzeniu; nic nie zaznaczone = reguła wyłączona. „nothing ticked = rule off” (`context/archive/2026-10-11-threshold-pattern-rewards/plan-brief.md:15`). „Nowe zachowanie jest opcjonalne; stare sesje mogą go nie mieć.” (`context/foundation/prd-v2.md:106`). Evidence.

- Próg: „Threshold winners \| Every player reaching N earns it”; „Threshold once per player” (`plan-brief.md:22-23`). N domyślnie równe rozmiarowi planszy (`plan-brief.md:15`). Losowanie nagrody progu przy dołączeniu (`plan-brief.md:26`). Evidence.
- Linia: „whoever claims the last free field of a fully claimed line (latest `claimed_at`)”; „each completed line is a separate reward”; „Rows and columns only” (`plan-brief.md:21-24`). Jedna nagroda na wiersz/kolumnę wylosowana przy generowaniu (`plan-brief.md:26`). Evidence.
- Widoczność: „Player RPC reveals a line reward only when the line is full, threshold reward only at ≥ N” (`plan-brief.md:28`). Evidence.
- Cofnięcie: „Undo revokes automatically” (`plan-brief.md:15`). „undo + reclaim can move a line reward to a different player — intended” (`plan-brief.md:66`). Evidence.
- Stan „zdobyta” jest wyliczany z aktualnych zajęć, nie z osobnej księgi (`plan-brief.md:27`). Evidence.
- Reguły ustalane przy tworzeniu (`plan-brief.md:67`). Evidence.

### Gracz w obrębie sesji

- Wejście: kod + nick, bez konta (`context/foundation/prd.md:68`, `context/foundation/prd.md:133`).
- Od 2026-10-03 (claim, nowsze niż join tego samego dnia): dołączenie tworzy wiersz gracza sesji i kolor po kolei. Addendum A: kolor 1–8 (`context/archive/2026-10-03-player-claim-field-reward/plan.md:411-418`).
- Tożsamość produktowa: „tożsamość żyje tylko w obrębie sesji” (`context/foundation/prd.md:133`). „Brak statystyk i historii gracza między sesjami” (`context/foundation/prd.md:142`). Powtórzone jako non-goal zmiany: `context/foundation/prd-v2.md:122`.
- Ciasteczko nicku na 400 dni jest w briefie dołączenia (`context/archive/2026-10-03-player-join-shared-board/plan-brief.md:23`) i służy auto-dołączeniu przy regeneracji. Napięcie z „tylko w obrębie sesji” — sekcja konfliktów.
- Regeneracja: nowy wiersz i nowy kolor, stary token zajęcia nie przechodzi (`gm-regenerate-board/plan-brief.md:56`).

### Katalog

- MVP: baza haseł i lista nagród dostarczone z góry, bez ekranu edycji (`context/foundation/prd.md:105`, `context/foundation/prd.md:131`).
- Seed czyta się jako katalog: 32 hasła (`supabase/seed.sql:5-36`) i 6 nagród (`supabase/seed.sql:39-68`). Evidence (policzone z przeczytanych wierszy).
- Ekran administratora i filtr kategorii/systemu: nice-to-have, zaparkowane (`context/foundation/prd.md:104-106`; `context/foundation/roadmap.md:143`). Brak cyklu „edycja katalogu” w MVP. Unknown, jak katalog się zmienia po starcie poza seedem.

## Rules

Reguły v1 zostają, także gdy późniejszy dokument zmiany mówi coś innego. Nowsze zdanie jest wskazane przy konflikcie, nie zamiast starszego.

### Zajmowanie pola (encja: pole)

1. „Nigdy dwóch graczy nie posiada tego samego pola — nawet gdy klikną niemal równocześnie.” (`context/foundation/prd.md:45`). Policy.
2. „pole należy do pierwszego gracza, który je oznaczył, i tylko jemu przypisana zostaje nagroda z tego pola; kolejne kliknięcia innych graczy nie zmieniają stanu.” (`context/foundation/prd.md:123`). Encja.
3. „Drugi gracz klikający to samo pole chwilę później widzi, że pole jest już zajęte i przez kogo; jego kliknięcie nie zmienia stanu.” (`context/foundation/prd.md:58`). Encja.
4. „Pole bez nagrody też daje graczowi wyraźne potwierdzenie zajęcia (bez fałszywego "brak nagrody" jako błędu).” (`context/foundation/prd.md:59`). Encja.
5. „Stan planszy przetrwa odświeżenie strony, zerwanie sieci i ponowne wejście kodem.” (`context/foundation/prd.md:47`). Policy.
6. „Po odświeżeniu u każdego uczestnika sesji pole jest widoczne jako zajęte przez tego gracza.” (`context/foundation/prd.md:60`). Encja.
7. „Zmiana stanu pola jest widoczna u pozostałych uczestników sesji najpóźniej po 10 s, bez ręcznego odświeżania.” (`context/foundation/prd.md:112`). Policy. Brief zajęcia wybiera „Poll ~5s (≤10s NFR)” (`context/archive/2026-10-03-player-claim-field-reward/plan-brief.md:21`).

### Widoczność nagrody (encja: pole / nagroda)

8. „Gracz widzi, które pola oferują nagrodę; rodzaj nagrody poznaje dopiero po zajęciu pola.” (`context/foundation/prd.md:88`). „MG nadal widzi typy nagród od początku jako ścieżkę operacyjną przy stole.” (`context/foundation/prd.md:89`). Encja. Nowsze niż shape notes z 2026-09-18; commit `f222ffc` 2026-10-03.
9. „MG widzi, kto zdobył którą nagrodę, żeby mógł ją wręczyć w fikcji gry.” (`context/foundation/prd.md:61`). Encja.
10. Dla progu i linii: ujawnienie graczowi dopiero przy pełnej linii albo przy ≥ N (`threshold-pattern-rewards/plan-brief.md:28`). Encja. 2026-10-11.
11. „Other players' rewards on the player board” jest poza zakresem tego slice’a (`plan-brief.md:44`). Gracz widzi „own progress + earned list”; MG „earned per player in roster” (`plan-brief.md:30`). Encja.

### Cofnięcie (encja: pole)

12. „cofnięcie zwalnia pole i unieważnia powiązaną nagrodę” (`context/foundation/prd.md:92`). Encja.
13. „Clear claim only; keep `reward_id`” (`context/archive/2026-10-03-gm-undo-field-claim/plan-brief.md:21`). Encja.
14. „Session gate \| `active` only” (`plan-brief.md:24`). Encja.
15. Cofnięcie progu i linii jest automatyczne (`threshold-pattern-rewards/plan-brief.md:15`). Encja. 2026-10-11.

### Dołączenie i tożsamość (policy)

16. „Gracz może dołączyć do sesji kodem i nickiem, bez konta.” (`context/foundation/prd.md:68`). Policy.
17. „tożsamość żyje tylko w obrębie sesji” (`context/foundation/prd.md:133`). Policy.
18. „Brak statystyk i historii gracza między sesjami — gracz nie ma tożsamości poza jedną sesją” (`context/foundation/prd.md:142`). Policy. v2: „Brak kont dla graczy i historii między sesjami” (`context/foundation/prd-v2.md:122`).
19. „Osoba bez ważnego kodu sesji nie widzi planszy.” (`context/foundation/prd.md:137`). Policy.
20. „Niezalogowany użytkownik na trasie MG lub administratora trafia na ekran logowania.” (`context/foundation/prd.md:136`). Policy.
21. „Brak współprowadzenia — jedna sesja ma jednego MG.” (`context/foundation/prd.md:145`). Policy.
22. „Aplikacja nie weryfikuje wykonania zadania — nie integruje się z rzutami kości, VTT ani kartami postaci; uznanie należy do MG przy stole.” (`context/foundation/prd.md:143`). Policy. „uczciwość należy do stołu, MG ma FR-012 do korekty” (`context/foundation/prd.md:87`).
23. „Brak współdzielenia własnych haseł między MG i brak publicznej biblioteki haseł społeczności” (`context/foundation/prd.md:144`). Policy.
24. „Brak synchronizacji na żywo” (`context/foundation/prd.md:148`). „Brak trybu offline — przy stole wymagane jest połączenie z siecią.” (`context/foundation/prd.md:149`). „Brak wielojęzyczności — interfejs i baza haseł w jednym języku.” (`context/foundation/prd.md:151`). Policy.
25. Nick: „Trimmed, 1–24 characters, duplicates allowed” (`player-join-shared-board/plan-brief.md:29`). „Duplicate nicks \| Allowed; distinct rows” (`player-claim-field-reward/plan-brief.md:29`). Encja gracza w sesji.
26. Cudzy MG na czyjejś sesji: „Wrong-owner denial stays 404, not 403” (`testing-abuse-join-identity/plan-brief.md:54`). „another MG gets `404` for the session” (`gm-create-session-board/plan-brief.md:75`). Policy.
27. „Valid active session code still allows public board poll without player cookie (by design).” (`testing-abuse-join-identity/plan-brief.md:55`). Policy. 2026-10-07. Strona z formularzem nicku haseł nie pokazuje: „renders the nick form and no cell phrases” (`player-join-shared-board/plan-brief.md:55`). Dwa zdania o dwóch powierzchniach; nie rozstrzygnięte, czy poll zwraca hasła. Inference: to nie jest jedno zdanie o tym samym ekranie.
28. Zgadywanie kodu: „Osoba spoza stołu zgadująca kody sesji nie trafi w aktywną sesję w rozsądnym czasie (< 1 trafienie na 100 000 prób).” (`context/foundation/prd.md:111`). Policy.

### Składanie planszy (encja: sesja / plansza)

29. „Z puli haseł (predefiniowanych i własnych MG) oraz puli nagród … aplikacja losowo składa planszę N×N” (`context/foundation/prd.md:119`). Encja.
30. „Wyjście: plansza N×N z unikalnymi hasłami i losowo rozmieszczonymi nagrodami.” (`context/foundation/prd.md:121`). Encja.
31. Rozmiary w decyzji tworzenia: „3×3, 4×4, 5×5 (default 5×5)” (`gm-create-session-board/plan-brief.md:24`). Domyślne 5×5 jest też w FR-004 (`prd.md:74`). Encja.
32. „checked ones always land on the board (max = cells of chosen size)” (`plan-brief.md:23`). „Guaranteed custom phrases always appear; phrases on a board are unique; rewards land on exactly Σcount cells” (`plan-brief.md:75`). Encja.
33. „pool shortage → validation error naming the missing count” (`plan-brief.md:24`). Encja. Otwarte pytanie v1 dla większych plansz zostaje (`prd.md:156`).
34. „Default rewards \| Inspiracja ×3, all others ×0” (`plan-brief.md:25`). Encja.
35. „W MVP nagrody pochodzą z ustalonej listy wprowadzonej przez administratora …; własne nagrody MG to FR-015 (nice-to-have).” (`prd.md:123`). Policy.
36. „korzystać z bazy predefiniowanej bez prawa jej edycji” — tabela ról, kolumna „Może”, wiersz Mistrz Gry (`prd.md:132`). Policy.

### Regeneracja, QR, usuwanie (encja: sesja) — zdania v1 i zdania nowsze

37. v1, nadal w prd.md (zdanie wprowadzone 2026-09-20, `git log -S` pokazuje tylko `3f0c07b`; plik prd.md ostatnio ruszony 2026-10-03, tego zdania nie zmieniał): „MG może wygenerować nową planszę (nowy kod); gracze muszą do niej dołączyć na nowo.” (`prd.md:80`). „ponowne dołączanie świadomie zaakceptowane w MVP” (`prd.md:81`). Encja.
38. Nowsze, 2026-10-11: „this plan keeps new code but softens rejoin via auto-join.” (`gm-regenerate-board/plan.md:16`). „If a successor exists and a nick is available from the cookie, the client auto-joins the new code and redirects to `/play/{newCode}` without a nick form.” (`plan.md:21`). Encja.
39. „Revealing that a closed code “existed” is an intentional product override of S-02’s unknown≡closed not-found rule for closed rows only; unknown codes stay opaque 404.” (`plan.md:30`). Encja. Starsze: „A missing, malformed, or closed code all show "Nie znaleziono sesji"” (`player-join-shared-board/plan-brief.md:16`).
40. „Closed sessions show no QR control.” (`player-join-via-qr/plan-brief.md:15`). „Dołączanie do planszy nadal działa (w tym istniejący flow z kodem nie może się zepsuć przez QR/link).” (`prd-v2.md:55`). Policy.
41. „Usunięcie sesji nie kasuje aktywnej sesji bez świadomej akcji MG.” (`prd-v2.md:56`). „bez potwierdzenia nic się nie kasuje” (`prd-v2.md:70`). Encja.
42. „Istniejące sesje / plansze po wdrożeniu nadal działają.” „Nowe zachowanie nagród jest opcjonalne; istniejące sesje nie są zmuszane do nowych reguł” (`prd-v2.md:94-96`). Policy.

### Nagrody progowe (encja: nagroda) — must-have v2, obok v1

43. „Gracz może zdobywać nagrody za ogólną liczbę zdobytych pól oraz za układy (np. cały wiersz/kolumna), nie tylko za konkretne pole.” (`prd-v2.md:85`). „progi mają być proste (np. jeden czytelny próg)” (`prd-v2.md:87`). Policy zmiany.
44. „Completer wins” i „Every player reaching N earns it” oraz „Rows and columns only” (`threshold-pattern-rewards/plan-brief.md:21-24`). Encja.
45. Poza zakresem tego slice’a: „Diagonals, per-player-owned or team lines” (`plan-brief.md:42`). To wyłączenie zakresu, nie uchylenie FR-014. Evidence zakresu; FR-014 zostaje osobno.

### Nagroda drużynowa v1 (zostaje)

46. „Gracze mogą zdobyć nagrody drużynowe.” Priority nice-to-have (`prd.md:98`). Definicja układu otwarta (`prd.md:155`). Roadmap 2026-10-14: „S-02 domknęło progi i układy indywidualne, nie nagrodę drużynową ani własne nagrody MG.” (`roadmap.md:142`). „S-02 (progi oraz wiersz/kolumna indywidualne) tego nie rozstrzyga.” (`roadmap.md:128`). Policy, nadal otwarta.

Wszystkie pozycje tej sekcji: evidence, o ile przy pozycji nie napisano inference.

## Multiple meanings

1. **układ / linia.** v1: „układ” w nagrodzie drużynowej, pytanie otwarte — „pełna linia (wiersz/kolumna/przekątna) przez dowolnych graczy, cała plansza, inny wzór” (`prd.md:155`). v2 i brief progu: układ jako wiersz lub kolumna zdobywana przez gracza, który domyka linię (`prd-v2.md:85`; `threshold-pattern-rewards/plan-brief.md:21`). Roadmap trzyma oba sensy osobno (`roadmap.md:128`, `roadmap.md:142`). Evidence. Granica: nagroda drużyny kontra nagroda osoby, która domyka linię.

2. **zadanie.** „zadanie z tego pola” to czynność z hasła (`prd.md:54`). „Zadanie poboczne” to typ nagrody z katalogu (`supabase/seed.sql:52-53`). Evidence.

3. **nagroda i bonus.** Wizja i FR mówią „nagroda”. Persona i tabela ról mówią „bonusy” / „przyznawać i widzieć bonusy” (`prd.md:32`, `prd.md:132`) bez osobnej definicji. Inference: w v1 to ten sam przedmiot wręczany w fikcji; źródła tego nie zrównują zdaniem.

4. **sesja i plansza.** FR-004 tworzy „sesję bingo” z parametrami planszy (`prd.md:74`). Decyzja 2026-09-27: „One `sessions` row = one board + one code” (`gm-create-session-board/plan-brief.md:21`). Socrates w v1 odrzuca wiele plansz pod jednym kodem (`prd.md:81`). Regeneracja tworzy nową sesję, nie drugą planszę w tej samej (`gm-regenerate-board/plan.md:16`, „not in-place cell rewrite”). Evidence: w przyjętym modelu sesja i plansza mają jeden kod i jeden cykl. Słowo „plansza” zostaje nazwą siatki.

5. **kto dostaje nagrodę katalogową.** Inspiracja i Doświadczenie: „dla zdobywcy pola” (`seed.sql:43`, `seed.sql:68`). Zadanie poboczne: „dla drużyny” (`seed.sql:53`). To opisy pozycji katalogu, nie druga reguła przyznawania. Evidence opisów; czy MG wręcza zadanie poboczne drużynie, gdy pole zajął jeden gracz — unknown w wymaganiach.

6. **„Może” w tabeli ról v2.** v1 wymienia pełne uprawnienia MG i administratora (`prd.md:131-132`). v2: „No access control changes — current model preserved” (`prd-v2.md:110`) i tabela „Może (dziś)” (`prd-v2.md:112-115`). „Brak nowych ról i brak przesunięć granic ról w tej zmianie.” (`prd-v2.md:117`). Evidence. Inference: węższa kolumna „Może (dziś)” opisuje stan na dzień zmiany, bo akapit mówi, że granic ról nie przesuwa. Administratora v2 w tej tabeli nie powtarza.

7. **north star.** „North star tu oznacza: najmniejszy slice end-to-end” (`roadmap.md:39`). To słowo planu kamienia, nie słowo stołu. Evidence. Nie zastępuje wizji z `prd.md:22`.

## Conflicting statements

Nowsze znaczy datę dokumentu albo commit. Starsze zostaje w aktach.

1. **Rodzaj nagrody: od początku czy dopiero po zajęciu.**
   - Starsze (shape notes, frontmatter updated 2026-09-18; treść nadal w archiwum): „Gracz widzi, które pola oferują nagrodę i jaką.” oraz „rodzaj nagrody jest widoczny od początku, nie dopiero po zajęciu.” (`context/foundation/archive/shape-notes-2026-10-11-1304.md:151-152`). Logika: „Gracze od początku widzą, które pola mają nagrodę i jaką” (`:184`).
   - Nowsze (prd.md, commit `f222ffc` 2026-10-03 14:31 +0200): „rodzaj nagrody poznaje dopiero po zajęciu pola” i „mystery-until-claim” (`prd.md:88-89`). Brief zajęcia mówi wprost: „FR-010 is amended” (`player-claim-field-reward/plan-brief.md:15`).
   - Evidence. Wymaganie produktowe po 2026-10-03 jest mystery dla gracza. Archiwum shape notes tego nie nadpisuje.

2. **Nowa plansza: gracze dołączają sami czy aplikacja przenosi ich sama.**
   - Starsze (prd.md:80, zdanie z bootstrapu 2026-09-20 `3f0c07b`; `git log -S "dołączyć na nowo"` nie pokazuje późniejszej zmiany): „gracze muszą do niej dołączyć na nowo.” Akceptacja: „ponowne dołączanie świadomie zaakceptowane w MVP” (`prd.md:81`).
   - Nowsze (plan regeneracji, archiwum 2026-10-11 `edc87cd`): „softens rejoin via auto-join” (`gm-regenerate-board/plan.md:16`) i auto-join bez formularza nicku, gdy nick jest w ciasteczku (`plan.md:21`). Tytuł zmiany: „players auto-rejoin” (`change.md:3`).
   - Evidence. prd.md tego zdania nie zaktualizowało. Oba obowiązują jako teksty; nowsze jest decyzja slice’a, starsze jest nadal literą FR-007.

3. **Kod zamknięty: „nie znaleziono” czy plansza tylko do odczytu.**
   - Starsze (join, archiwum 2026-10-03 13:44 `9d05792`): malformed, unknown i closed dają jedno „Nie znaleziono sesji” (`player-join-shared-board/plan-brief.md:16` i `:28`).
   - Nowsze (regeneracja, 2026-10-11): „Explicit product override of S-02 unknown≡closed” (`gm-regenerate-board/plan-brief.md:26`); „Player closed code \| Read-only closed board (not 404)”. Plan: override tylko dla wierszy closed; nieznany kod zostaje 404 (`plan.md:30`). Test-plan, last updated 2026-10-11: „GET /api/play/board?code={old} → 200 with status: "closed" + successorCode” (`test-plan.md:201`).
   - Evidence.

4. **Kolor gracza: los 1–16 czy kolejność 1–8.**
   - Starsze tego samego dnia (join, 13:44): „Random token 1–16, stable per code in this browser” (`player-join-shared-board/plan-brief.md:30`), „no players table” (`:23`).
   - Brief zajęcia (archiwum 16:18) miesza „cycle 1–8” (`player-claim-field-reward/plan-brief.md:29`) z „More than 16 joiners reuse colors (modulo 16)” (`:70`).
   - Nowsze w planie zajęcia, nagłówek z datą: „Addendum A — Player colors locked to 1–8 (2026-10-03)”. „Post-plan decisions that supersede earlier contracts.” (`plan.md:409-411`). „color = ((join_ordinal - 1) % 8) + 1” (`:418`). „Do not re-expand the CHECK or reintroduce tokens 9–16 without a new product decision.” (`:421`).
   - Evidence. Po addendum kolory są 1–8, po kolei dołączeń. Zdanie „modulo 16” w briefie jest starsze niż addendum.

5. **Odświeżenie ręczne a widoczność do 10 s.** W tym samym prd.md: kryterium sukcesu mówi, że pozostali widzą zajętość „po odświeżeniu” (`prd.md:39`); NFR mówi „bez ręcznego odświeżania” najpóźniej po 10 s (`prd.md:112`). Non-goal: „Brak synchronizacji na żywo” (`prd.md:148`). Żadne z tych trzech nie ma późniejszej daty wewnątrz pliku. Rozstrzygnięcie operacyjne 2026-10-03: polling ~5 s (`player-claim-field-reward/plan-brief.md:21`). Evidence wszystkich trzech zdań; polling jest nowszy jako decyzja slice’a i nie wykreśla zdania o odświeżeniu z kryterium sukcesu.

6. **Tożsamość tylko w sesji a nick pamiętany 400 dni.** Non-goal v1 i v2: brak historii między sesjami (`prd.md:142`, `prd-v2.md:122`). Brief dołączenia: ciasteczko „400 days, renewed on each confirm” i „a session a week later still knows the nick” (`player-join-shared-board/plan-brief.md:23`, `:16`). Evidence obu. Inference: ciasteczko jest pamięcią przeglądarki nicku, nie kontem; dokumenty nie mówią, że nick między sesjami jest historią gracza. Granica nie jest dopisana jednym zdaniem.

## Unknowns

- Definicja „układu” nagrody drużynowej (FR-014): nadal pytanie właściciela, roadmap 2026-10-14 nie zamyka go slice’em progów (`prd.md:155`, `roadmap.md:128`). Przekątne są poza zakresem briefu progu (`threshold-pattern-rewards/plan-brief.md:42`), bez osobnej decyzji produktu „przekątnych nie będzie nigdy”.
- Co gdy haseł jest mniej niż pól na planszy większej niż 5×5 (`prd.md:156`). Dla 3×3–5×5 decyzja tworzenia: błąd walidacji z brakującą liczbą (`gm-create-session-board/plan-brief.md:24`).
- Czy „bonus” jest czymś innym niż „nagroda” — brak zdania, które je rozdziela albo utożsamia. Szukane: prd.md (wystąpienia obu słów), prd-v2.md (słowo bonus w przeczytanym tekście się nie pojawia jako definicja).
- Co dzieje się z sesją po wieczorze (≥ 8 h): NFR dostępności jest (`prd.md:114`), wygasania brak (`gm-create-session-board/plan-brief.md:26`). Przejścia czasowego nie znalazłem w prd, prd-v2, roadmapie ani briefie tworzenia.
- Kto poza regeneracją ustawia `closed` bez następcy. Brief opisuje wygląd takiego stanu (`gm-regenerate-board/plan-brief.md:28`) i nie nazywa drugiej operacji.
- Czy poll planszy samym kodem, bez ciasteczka gracza, pokazuje hasła. Brief testów mówi, że taki poll jest zamierzony (`testing-abuse-join-identity/plan-brief.md:55`). Brief dołączenia mówi, że formularz nicku nie zawiera haseł (`player-join-shared-board/plan-brief.md:55`). Treści `plan.md` tego slice’a testowego nie czytałem.
- `context/ideas/rewards.md` ma tylko nagłówek i zdanie o backlogu (linie 1–3). Brak haseł nagród do dopisania. `context/ideas/phrases.md:5` ma jedno hasło „Zrań sojusznika obszarowym zaklęciem”; wśród 32 tekstów seeda (`seed.sql:5-36`) tego zdania nie ma.
- README, CLAUDE.md, AGENTS.md: wyszukanie `sesj|plansz|nagrod|hasł|Mistrz|bingo|gracz`. README i CLAUDE trafiają w nazwę workera `rpg-bingo`. AGENTS.md: „RPG Bingo is an Astro 7 SSR app…” (`AGENTS.md:3`) — brak reguł stołu. Szukane tylko te trzy pliki.
- Ciało audytu obserwability i `test-stack.md` / `tech-stack.md` / `infrastructure.md` / `deploy-plan.md`: czytane nagłówki, nie ciała. Czy w ciele jest reguła produktu — unknown w tym zakresie.
- Katalog ADR/RFC: nie szukałem drugi raz; `0-documents.md` mówi, że katalogu nie ma. Tego pliku nie traktuję jako dowodu produktu.

## Commands

- `Get-ChildItem` + `Select-String '^# '` po `context/archive/**/change.md` (nagłówki `# ` puste — tytuły są w frontmatter).
- `Get-ChildItem` z liczeniem linii `plan-brief.md` i `plan.md`.
- `git log -1` oraz `git log -S` dla `mystery-until-claim`, `dołączyć na nowo`, `widoczny od początku` na `context/foundation/prd.md` i archiwum shape notes (daty konfliktów).
