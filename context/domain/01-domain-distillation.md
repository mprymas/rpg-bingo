---

## title: "Domain distillation: RPG Bingo"
artifact: domain-distillation
type: domain-distillation
created: 2026-10-18
repo_root: c:\projects\php\rpg-bingo
code_scope: .
head: 3a311f2
dirty: "untracked context/domain/"
documents: "2 requirements, 25 narrative (14 read in full, 22 change titles), 5 reference, 8 engineering"
previous: none
evidence: context/domain/evidence/
glossary: context/domain/glossary.md

# Domain distillation: RPG Bingo

## Summary

RPG Bingo jest wspólną planszą bingo na jedną sesję papierowego RPG: Mistrz Gry (MG) z kontem składa planszę z haseł i nagród, gracze wchodzą kodem i nickiem bez konta, a pole zajmuje pierwszy, kto je oznaczy. Rdzeń to reguła zamiast uznania MG — „pole zajęte raz” i nagroda wynikająca z pola, progu albo wiersza/kolumny. W tabeli jest 15 terminów Core i 15 Supporting; w kodzie brakuje 3 Supporting (nagroda drużynowa, administrator katalogu, własne nagrody MG) i żadnego Core. Najsilniejszy rozjazd: wymaganie mówi, że wyjściem tworzenia jest plansza N×N, a przerwany zapis zostawia sesję bez komórek. Kandydat #1 to agregat Sesja, bo ten niezmiennik jest tylko w generatorze, nie w bazie, i ta sama ścieżka potrafi zostawić dwie sesje `active` po nieudanej regeneracji. Rozjazdy wg strony naprawy: kod 2, dokument 1, decyzja 2. Otwarte pytania: 5. Ograniczenie: oba PRD są szkicami, a prd-v2 jest dokumentem zmiany, nie uchyleniem wizji v1.

## Changes since the previous run

Brak poprzedniego raportu.

## Ubiquitous language

Cytat jest słowami źródła. „BRAK w kodzie” stoi dopiero po wyszukaniu podanym w komórce. Tezy (drużyna, stół, uznaniowość, satysfakcja) są pod tabelą i nie wchodzą do licznika.

| id | term | kind | definition (quoted) | source | in code (path:line) or **missing in code** | other names in code |
| --- | --- | --- | --- | --- | --- | --- |
| T-01 | Mistrz Gry | role | „Persona główna: Mistrz Gry (MG). Prowadzi sesje papierowego RPG dla stałej drużyny.” | `context/foundation/prd.md:28` | Brak typu `GameMaster`. Rola: prefiks `Gm*` (`GmBoard`) i parametr `gmId` `src/lib/services/sessions.service.ts:200`; etykieta „Panel MG” `src/pages/dashboard/index.astro:30`. `gm_id` to tylko klucz konta na sesji `supabase/migrations/20260927143000_sessions_and_board_cells.sql:6` | `gm`, `gmId`, `Gm*`. Nie nazywać roli `gm_id` |
| T-02 | Gracz | role | „Gracz. Członek drużyny. Dołącza z telefonu, widzi wspólną planszę” | `context/foundation/prd.md:32` | `supabase/migrations/20261003140000_session_players_and_claims.sql:5` (`session_players`); „Gracze” `src/components/play/PlayerRosterList.tsx:111` | `session_players`, `nick`, cookie `rpg_player` |
| T-03 | sesja | entity | „MG może utworzyć sesję bingo z parametrami: rozmiar planszy (domyślnie 5x5), własne hasła, dostępne nagrody i ich liczba.” | `context/foundation/prd.md:74` | `supabase/migrations/20260927143000_sessions_and_board_cells.sql:4`; `Session` `src/types.ts:5` | `sessions`, `SessionStatus` |
| T-04 | plansza | entity | „Wspólna plansza dla całej sesji z zasadą "pole zajęte raz"” | `context/foundation/prd.md:24` | `sessions.size` `supabase/migrations/20260927143000_sessions_and_board_cells.sql:8`; „Generuj planszę” `src/components/sessions/NewSessionForm.tsx:365` | `size`, `board_cells`, `BoardSize`. Osobnej tabeli `boards` nie ma |
| T-05 | pole | entity | „kafelek oznacza się kolorem/nickiem gracza, staje się niedostępny dla innych” | `context/foundation/prd.md:55` | `board_cells` `supabase/migrations/20260927143000_sessions_and_board_cells.sql:16`; „Zajmij pole” `src/components/play/PlayerBoard.tsx:481` | `board_cells`, `BoardCell`, `position`, `fieldRewards` |
| T-06 | hasło | value | „system losuje hasła z bazy predefiniowanej i własnych” | `context/foundation/prd.md:76` | `phrases` `supabase/migrations/20260927134220_phrases_and_rewards.sql:4`; „Własne hasła” `src/components/sessions/NewSessionForm.tsx:233` | `phrase`, `phrases.text`, `customPhrases` |
| T-07 | nagroda | value | „powiązanie nagrody z konkretnym, widocznym dla wszystkich polem usuwa uznaniowość” | `context/foundation/prd.md:24` | `rewards` `supabase/migrations/20260927134220_phrases_and_rewards.sql:11`; `Reward` `src/types.ts:4` | `reward`, `slug`, `label`. Słowa `bonus` nie ma w `src/**/*.{ts,tsx,astro}` ani w `supabase/**/*.sql` |
| T-08 | kod sesji | value | „MG otrzymuje krótki kod sesji.” | `context/foundation/prd.md:78` | CHECK 6 znaków `supabase/migrations/20260927143000_sessions_and_board_cells.sql:7`; `SESSION_CODE_PATTERN` `src/lib/services/session-code.ts:5` | `code`, `SESSION_CODE_LENGTH` |
| T-09 | wolne | state | „Gracz może oznaczyć wolne pole jako zdobyte przez siebie.” | `context/foundation/prd.md:86` | `claimed_by_player_id IS NULL` `supabase/migrations/20261003190000_player_claim_token.sql:174` | brak enumu `free`; para NULL w `board_cells_claim_pair_chk` `supabase/migrations/20261003140000_session_players_and_claims.sql:36` |
| T-10 | zajęte | state | „pozostali po odświeżeniu widzą pole jako zajęte” | `context/foundation/prd.md:39` | wynik `'claimed'` `supabase/migrations/20261003190000_player_claim_token.sql:179`; „Pole jest zajęte” `src/components/play/PlayerBoard.tsx:352` | `claimed`, `claimed_by_player_id`, `claimed_at` |
| T-11 | oznaczenie | operation | „w aplikacji oznaczenie wykonuje gracz” | `context/foundation/prd.md:135` | `claim_board_cell` `supabase/migrations/20261003190000_player_claim_token.sql:168`; `POST` `src/pages/api/play/claim.ts:19` | `claim`, „Zajmij”, „Cofnij oznaczenie” |
| T-12 | mystery-until-claim | policy | „rodzaj nagrody poznaje dopiero po zajęciu pola” | `context/foundation/prd.md:88` | `has_reward` bez sluga, dopóki pole wolne `supabase/migrations/20261011140000_player_board_active_or_closed.sql:31`; `PlayerBoardCell` `src/types.ts:133` | `hasReward`, `has_reward` |
| T-13 | nagroda za konkretne pole | policy | „[preserved] Gracz może zdobywać nagrody przypisane do konkretnego pola.” | `context/foundation/prd-v2.md:88` | `board_cells.reward_id` `supabase/migrations/20260927143000_sessions_and_board_cells.sql:21` | `reward_id`, `fieldRewards`, `field_rewards` |
| T-14 | nagroda za liczbę pól | measure | „po osiągnięciu progu liczby pól dostaje nagrodę „za liczbę”” | `context/foundation/prd-v2.md:64` | `sessions.threshold_count` `supabase/migrations/20261011170000_threshold_pattern_rewards.sql:5`; „Próg — liczba pól (N)” `src/components/sessions/RewardRulesFields.tsx:110` | `threshold`, `thresholdCount`, `kind = 'threshold'` |
| T-15 | nagroda za wiersz/kolumnę | policy | „a reward for holding N claimed fields and a reward for each completed row/column” | `context/archive/2026-10-11-threshold-pattern-rewards/plan-brief.md:7` | `board_lines.axis` CHECK `('row','column')` `supabase/migrations/20261011170000_threshold_pattern_rewards.sql:23`; „Nagrody za wiersz lub kolumnę” `src/components/sessions/RewardRulesFields.tsx:88` | `line`, `LineAxis`, `board_lines` |
| T-16 | nick | value | „Trimmed, 1–24 characters, duplicates allowed” | `context/archive/2026-10-03-player-join-shared-board/plan-brief.md:29` | `nick text NOT NULL` `supabase/migrations/20261003140000_session_players_and_claims.sql:8`; „Nick” `src/components/play/JoinNickForm.tsx:31` | `nick`, `canonicalPlayerNick` |
| T-17 | kolor | value | „kafelek oznacza się kolorem/nickiem gracza” | `context/foundation/prd.md:55` | `CHECK (color BETWEEN 1 AND 8)` `supabase/migrations/20261003180000_player_colors_8.sql:11`; `((v_join_ordinal - 1) % 8) + 1` `supabase/migrations/20261011170000_threshold_pattern_rewards.sql:153` | `color` |
| T-18 | własne hasła | value | „Each custom phrase has a "gwarantowane na planszy" checkbox; checked ones always land on the board” | `context/archive/2026-09-27-gm-create-session-board/plan-brief.md:23` | `CustomPhraseInput.guaranteed` `src/types.ts:19`; „Gwarantowane na planszy” `src/components/sessions/NewSessionForm.tsx:263` | `customPhrases`, `guaranteed`. Brak kolumny `guaranteed` w migracjach |
| T-19 | baza predefiniowanych haseł | entity | „Predefiniowana, utrzymywana przez administratora systemu baza haseł specyficznych dla RPG” | `context/foundation/prd.md:24` | `phrases` `supabase/migrations/20260927134220_phrases_and_rewards.sql:4`; seed `supabase/seed.sql:5` | `phrases`, `predefined` |
| T-20 | cofnięcie | operation | „MG może cofnąć błędne oznaczenie pola; cofnięcie zwalnia pole i unieważnia powiązaną nagrodę.” | `context/foundation/prd.md:92` | `undo_board_cell` `supabase/migrations/20261003200000_undo_board_cell.sql:4`; „Cofnij oznaczenie” `src/components/sessions/GmBoard.tsx:327` | `undo` |
| T-21 | regeneracja | operation | „MG może wygenerować nową planszę (nowy kod)” | `context/foundation/prd.md:80` | `replaceSessionId` `src/types.ts:70`; „Wygeneruj nową planszę” `src/components/sessions/GmRegenerateControls.tsx:58` | `replaceSessionId`, `close_session_as_replaced` |
| T-22 | successor | value | „the prior session becomes `closed` and points at the successor” | `context/archive/2026-10-11-gm-regenerate-board/plan.md:5` | `replaced_by_session_id` `supabase/migrations/20261011133000_session_close_replaced_by.sql:5`; `successorCode` `src/types.ts:149` | `replaced_by_session_id`, `successor_code`, „następczy kod” |
| T-23 | active | state | „`status` column (`active`/`closed`), default `active`” | `context/archive/2026-09-27-gm-create-session-board/plan-brief.md:26` | `CHECK (status IN ('active', 'closed'))` `supabase/migrations/20260927143000_sessions_and_board_cells.sql:9` | `SessionStatus`, etykieta „Aktywna” |
| T-24 | closed | state | „Old board is closed and read-only.” | `context/archive/2026-10-11-gm-regenerate-board/plan-brief.md:15` | `SET status = 'closed'` `supabase/migrations/20261011133000_session_close_replaced_by.sql:54` | `closed`, „Zamknięta”, „Sesja zamknięta” |
| T-25 | usunięcie sesji | operation | „MG może usunąć sesję niezależnie od statusu, po potwierdzeniu.” | `context/foundation/prd-v2.md:81` | `delete_session` `supabase/migrations/20261011163400_delete_session.sql:4`; `DELETE` `src/pages/api/sessions/[id].ts:19` | `deleteSession` |
| T-26 | kod QR | value | „Gracz może dołączyć do planszy za pomocą kodu QR.” | `context/foundation/prd-v2.md:75` | `SessionJoinQr.tsx:44` | `SessionJoinQr`, `buildPlayerJoinUrl` |
| T-27 | dołączenie | operation | „Gracz może dołączyć do sesji kodem i nickiem, bez konta.” | `context/foundation/prd.md:68` | `join_session_player` `supabase/migrations/20261011170000_threshold_pattern_rewards.sql:84`; `POST` `src/pages/api/play/join.ts:33` | `join`, „Wejdź” |
| T-28 | nagroda drużynowa | policy | „Drużyna zdobywa nagrodę drużynową (linię/układ pól) w trakcie sesji.” | `context/foundation/prd.md:42` | **missing in code**. Szukane: `admin\|drużyn\|diagonal\|przekątn\|team_reward\|teamReward` w `src/**/*.{ts,tsx,astro}` — zero; w `supabase/**/*.sql` tylko opis katalogu „dla drużyny” `supabase/seed.sql:53`. Oś linii to wyłącznie `row`/`column` | — |
| T-29 | administrator systemu | role | „Trzecia rola: administrator systemu, który utrzymuje bazę predefiniowanych haseł” | `context/foundation/prd.md:34` | **missing in code**. Szukane: `admin\|administrator` w `src/**/*.{ts,tsx,astro}` — zero. Jedyny ślad to komentarz „admin rewards” `supabase/migrations/20260927134220_phrases_and_rewards.sql:1`. Katalog jest seedem i polityką `SELECT` | — |
| T-30 | własne nagrody MG | value | „własne nagrody MG to FR-015 (nice-to-have).” | `context/foundation/prd.md:123` | **missing in code**. Tworzenie sesji przyjmuje tylko id z katalogu i rzuca `UNKNOWN_REWARD` `src/lib/services/sessions.service.ts:101`. W `src/`** nie ma zapisu do `rewards` (wstawienia sesji idą w `sessions`, `board_cells`, `session_reward_pool`, `board_lines` — `sessions.service.ts:132`) | — |

Pod tabelą: tezy, nie liczone — drużyna i stół (`context/foundation/prd.md:22`, `:24`), uznaniowość (`:22`), satysfakcja (`context/foundation/prd-v2.md:49`).

Generic, poza tabelą, jedna grupa: konto MG (e-mail, hasło logowania, `auth.users`). Spójne identyfikatory: `password` w formularzu, `phrase` na planszy.

Licznik: w dowodach dokumentów jest około 45 wierszy słownika (w tym katalog nagród, tezy i synonimy). W tabeli jest 30 terminów Core i Supporting. Core: 15, z czego 0 brakuje w kodzie. Supporting: 15, z czego 3 brakuje w kodzie (T-28, T-29, T-30).

Pojęcia tylko w kodzie, szukane w dokumentach z tej próbki (oba PRD, briefy z dowodu `1-docs-language.md`):

- Maks. 10 miejsc przy stole — `session_full` `supabase/migrations/20261011170000_threshold_pattern_rewards.sql:148`. W przeczytanych wymaganiach nie ma liczby 10. *searched in docs*.
- `claim_token` — sekret zajęcia `supabase/migrations/20261003190000_player_claim_token.sql:5`. Dokumenty mówią o nicku i kodzie, nie o tym sekrecie. *searched in docs*.
- Wynik zajęcia `claimed`  `conflict` — osobne od statusu sesji `supabase/migrations/20261003190000_player_claim_token.sql:179`. *searched in docs*.

## Multiple meanings and context boundaries

| id | word | meaning A (context, source) | meaning B (context, source) | suggested names |
| --- | --- | --- | --- | --- |
| B-01 | hasło | Fraza wyzwania na planszy. Kontekst stołu. `context/foundation/prd.md:76`; UI „Własne hasła” `src/components/sessions/NewSessionForm.tsx:233` | Hasło konta MG. Kontekst logowania. „Hasło” `src/components/auth/SignInForm.tsx:143` | `phrase` zostaje przy planszy; `password` zostaje przy koncie |
| B-02 | status | Stan sesji `active` \| `closed`. Kontekst życia sesji. `supabase/migrations/20260927143000_sessions_and_board_cells.sql:9` | Wynik zajęcia `claimed` \| `conflict`. Kontekst pola. `supabase/migrations/20261003190000_player_claim_token.sql:179` | `session.status` i `claim outcome` |
| B-03 | układ | Nagroda drużynowa, definicja otwarta (linia, przekątna, cała plansza). Kontekst drużyny. `context/foundation/prd.md:155` | Wiersz lub kolumna, którą dostaje gracz domykający linię. Kontekst osoby. `context/archive/2026-10-11-threshold-pattern-rewards/plan-brief.md:21`; roadmap trzyma oba sensy `context/foundation/roadmap.md:128` | „nagroda drużynowa” i „linia (wiersz/kolumna)” |
| B-04 | sesja / plansza | Sesja jako kod, właściciel, status, lista MG. `context/foundation/prd.md:74` | Plansza jako siatka N×N. `context/foundation/prd.md:24`. W kodzie to jeden wiersz: komentarz „Session (= one board, one code)” `supabase/migrations/20260927143000_sessions_and_board_cells.sql:1` | W rozmowie: sesja = rekord, plansza = komórki tej sesji. Nie wprowadzać tabeli `boards` bez nowej decyzji |
| B-05 | zadanie | Czynność z hasła, którą MG uznaje słownie. Kontekst stołu. „wykonanie zadania z tego pola” `context/foundation/prd.md:54` | Typ nagrody katalogowej. Kontekst katalogu. „Zadanie poboczne” `supabase/seed.sql:52` | „hasło” na czynność; `side-quest` na nagrodę. Słowa `zadanie` nie ma w `src/**/*.{ts,tsx,astro}` |

## Subdomains

Klasa wynika z wizji v1 (`context/foundation/prd.md:22`, `:24`) i kryterium sukcesu (`:39`). Cele v2 (QR, sprzątanie, satysfakcja z pola bez nagrody) są celami zmiany i nie przesuwają rdzenia.

| subdomain | class | concepts | why (goal quote, or description and usage) |
| --- | --- | --- | --- |
| Plansza i zajęcie pola | Core | T-03, T-04, T-05, T-06, T-08, T-09, T-10, T-11, T-18, T-21, T-22, T-23, T-24 | „Wspólna plansza dla całej sesji z zasadą "pole zajęte raz" zamienia bingo z solo-zabawy w mechanikę drużynową” (`context/foundation/prd.md:24`). Kryterium główne: jedna sesja przy stole, plansza, kod, oznaczenie, pole zajęte u pozostałych (`:39`). Strażnik: „Nigdy dwóch graczy nie posiada tego samego pola” (`:45`). |
| Nagroda z reguły | Core | T-07, T-12, T-13, T-14, T-15, T-20 | „nagrody typu inspiracja wynikały z czytelnej reguły, a nie z uznaniowej decyzji MG” (`context/foundation/prd.md:22`). Próg i linia są obecną postacią tej reguły obok nagrody na polu; v2 ich nie nazywa nowym produktem, tylko domknięciem celu pól (`context/foundation/prd-v2.md:85`). |
| Wejście do stołu | Supporting | T-02, T-16, T-17, T-26, T-27 | Gracz bez konta jest warunkiem stołu (`context/foundation/prd.md:68`), a QR jest celem zmiany (`context/foundation/prd-v2.md:49`), nie powodem, dla którego produkt istnieje. |
| Porządek sesji MG | Supporting | T-01, T-25 | MG jest personą główną (`context/foundation/prd.md:28`). Usuwanie sesji jest celem zmiany v2 (`context/foundation/prd-v2.md:49`), potrzebnym przy stole, nie przewagą wobec uznaniowej inspiracji. |
| Katalog haseł i nagród | Supporting | T-19, T-29, T-30 | „plansza powstaje w chwilę” dzięki bazie haseł (`context/foundation/prd.md:24`). Edycja katalogu i własne nagrody MG są nice-to-have (`:105`, `:123`) i zaparkowane (`context/foundation/roadmap.md:142`). |
| Nagroda drużynowa | Supporting | T-28 | Jest wtórnym kryterium sukcesu (`context/foundation/prd.md:42`) i nice-to-have (`:98`). Roadmapa 2026-10-14: progi i linie indywidualne tego nie zamykają (`context/foundation/roadmap.md:142`). |
| Konto MG | Generic | logowanie, e-mail, hasło konta | „Niezalogowany użytkownik na trasie MG lub administratora trafia na ekran logowania.” (`context/foundation/prd.md:136`). To zwykłe logowanie, nie przewaga produktu. |

## Invariants and policies

Osobnej warstwy domeny nie ma (`src/**/domain/**` — zero plików). Strażniki siedzą w SQL, w `src/lib/services/` i w zod.

### Sesja

| id | candidate | invariant (quoted) | source | status | guarded at | gap |
| --- | --- | --- | --- | --- | --- | --- |
| R-01 | Sesja | „Wyjście: plansza N×N z unikalnymi hasłami i losowo rozmieszczonymi nagrodami.” | `context/foundation/prd.md:121` | declared | Generator: `src/lib/services/board-generator.ts:82` i `:90`. Unikalność dokładnego tekstu i pozycji: `supabase/migrations/20260927143000_sessions_and_board_cells.sql:22`. Rozmiar 3–5: `:8` | Baza nie wymaga `COUNT(board_cells) = size²`. Zapis to cztery osobne inserty `src/lib/services/sessions.service.ts:132`. Strona gracza oddaje 422, gdy wierszy jest za mało `src/pages/play/[code].astro:81`, i nie kasuje sesji. |
| R-02 | Sesja | „Brak współprowadzenia — jedna sesja ma jednego MG.” | `context/foundation/prd.md:145` | enforced | `gm_id uuid NOT NULL` `supabase/migrations/20260927143000_sessions_and_board_cells.sql:6`; RLS `gm_id = auth.uid()` `:33` | Brak drugiego właściciela w schemacie. |
| R-03 | Sesja | „the prior session becomes `closed` and points at the successor” | `context/archive/2026-10-11-gm-regenerate-board/plan.md:5` | declared | Funkcja sama: `supabase/migrations/20261011133000_session_close_replaced_by.sql:52` | Create i close to dwa wywołania. Przy błędzie close API zwraca 201 i `closeError` `src/pages/api/sessions/index.ts:67`. Obie sesje zostają `active`. |
| R-04 | Sesja | „Sesja i stan planszy są dostępne kodem przez cały wieczór gry (≥ 8 h od utworzenia)” | `context/foundation/prd.md:114` | enforced | Brak zadania, które zamyka sesję po czasie. Jedyny zapis `status = 'closed'` jest jawnym close `supabase/migrations/20261011133000_session_close_replaced_by.sql:54`. Szukane: `cron`, `schedule`, `setInterval` w `src/**` — interwały to poll UI (`src/components/play/PlayerBoard.tsx:17`), nie wygaszanie | Dokument nie każe sesji umierać po 8 h. Gwarancja „host żyje 8 h” jest poza repozytorium. |

### Pole

| id | candidate | invariant (quoted) | source | status | guarded at | gap |
| --- | --- | --- | --- | --- | --- | --- |
| R-05 | Pole | „pole należy do pierwszego gracza, który je oznaczył, i tylko jemu przypisana zostaje nagroda z tego pola; kolejne kliknięcia innych graczy nie zmieniają stanu.” | `context/foundation/prd.md:123` | enforced | `UPDATE … WHERE claimed_by_player_id IS NULL` `supabase/migrations/20261003190000_player_claim_token.sql:168`. Para (kto, kiedy) albo obie NULL, albo obie ustawione `supabase/migrations/20261003140000_session_players_and_claims.sql:36` | Brak polityki UPDATE na `board_cells`. Drugi zapis w `src/**` nie istnieje. |
| R-06 | Pole | „rodzaj nagrody poznaje dopiero po zajęciu pola” oraz „MG nadal widzi typy nagród od początku” | `context/foundation/prd.md:88` | enforced | Projekcja gracza: slug/label tylko gdy pole zajęte `supabase/migrations/20261011140000_player_board_active_or_closed.sql:32`. MG czyta wiersz z etykietą `src/components/sessions/GmBoard.tsx:303` | Po zajęciu etykietę dostaje każdy, kto ma kod, nie tylko zdobywca. To zgodne z „po zajęciu”, nie z „tylko zdobywca”. |
| R-07 | Pole | „cofnięcie zwalnia pole i unieważnia powiązaną nagrodę” | `context/foundation/prd.md:92` | enforced | `undo_board_cell` czyści zajęcie i zostawia `reward_id` `supabase/migrations/20261003200000_undo_board_cell.sql:1`. Próg i linia są liczone z aktualnych zajęć, więc cofnięcie odbiera je przy następnym odczycie `src/lib/services/reward-progress.ts:34` | „Tylko zajęte” jest w UI `src/components/sessions/GmBoard.tsx:263`. RPC wolnego, istniejącego pola nie traktuje jako błędu — brief undo nazywa to idempotentnym sukcesem, więc to nie jest złamanie. |

### Postęp nagród

| id | candidate | invariant (quoted) | source | status | guarded at | gap |
| --- | --- | --- | --- | --- | --- | --- |
| R-08 | Postęp nagród | „Threshold winners \| Every player reaching N earns it” | `context/archive/2026-10-11-threshold-pattern-rewards/plan-brief.md:22` | enforced | RPC `supabase/migrations/20261011173000_player_reward_inputs_line_slots.sql:62`; TS `src/lib/services/reward-progress.ts:87` | Dwie implementacje tej samej reguły. Tej destylacji nie kończyło porównanie ich linia po linii. |
| R-09 | Postęp nagród | „whoever claims the last free field of a fully claimed line (latest `claimed_at`)” | `context/archive/2026-10-11-threshold-pattern-rewards/plan-brief.md:21` | enforced | SQL `ORDER BY c.claimed_at DESC, c.position DESC` `supabase/migrations/20261011173000_player_reward_inputs_line_slots.sql:204`; TS `isLaterClaim` `src/lib/services/reward-progress.ts:24` | Ta sama luka dwóch kopii co R-08. Przekątnych nie ma — brief je wyłącza (`plan-brief.md:42`), a CHECK osi to `row`/`column`. |

### Wejście i dostęp

| id | candidate | invariant (quoted) | source | status | guarded at | gap |
| --- | --- | --- | --- | --- | --- | --- |
| R-10 | Gracz sesji | „tożsamość żyje tylko w obrębie sesji” oraz „Brak statystyk i historii gracza między sesjami — gracz nie ma tożsamości poza jedną sesją” | `context/foundation/prd.md:133`, `:142` | declared | Konta gracza nie ma. Nick i token żyją w ciasteczku `PLAYER_COOKIE_MAX_AGE = 34560000` `src/lib/player-cookie.ts:3`. Auto-wejście do następcy używa nicku z ciasteczka `src/components/play/PlayerBoard.tsx:272` | prd-v2 powtarza non-goal jako „poza zakresem tej zmiany” `context/foundation/prd-v2.md:122` i nie mówi, czy 400 dni nicku jest w tym zakresie. Brief dołączenia wprost chce ciasteczka na 400 dni. |
| R-11 | Dostęp | „Osoba bez ważnego kodu sesji nie widzi planszy.” | `context/foundation/prd.md:137` | enforced | Nieznany kod: zero wierszy `supabase/migrations/20261011140000_player_board_active_or_closed.sql:46`; strona 404 `src/pages/play/[code].astro:46` | Kto zna kod, woła `GET /api/play/board` bez ciasteczka i dostaje hasła `src/pages/api/play/board.ts:32`. Nowszy brief nazywa taki poll zamierzonym `context/archive/2026-10-07-testing-abuse-join-identity/plan-brief.md:55`. Formularz nicku haseł nie renderuje `src/pages/play/[code].astro:121`. |
| R-12 | Dostęp | „Niezalogowany użytkownik na trasie MG lub administratora trafia na ekran logowania.” | `context/foundation/prd.md:136` | enforced | `PROTECTED_ROUTES = ["/dashboard", "/sessions"]` `src/middleware.ts:5`; API sesji sprawdza `locals.user` `src/pages/api/sessions/index.ts:41` | Trasy administratora nie ma (T-29). |
| R-13 | Dostęp | „Aplikacja nie weryfikuje wykonania zadania — nie integruje się z rzutami kości, VTT ani kartami postaci; uznanie należy do MG przy stole.” | `context/foundation/prd.md:143` | enforced | Claim nie przyjmuje potwierdzenia MG. Szukane w `src/**/*.{ts,tsx,astro}`: `zadanie`, `bonus`, `VTT` — zero. Uznanie jest poza aplikacją, zgodnie z tym zdaniem | — |
| R-14 | Dostęp | „Zmiana stanu pola jest widoczna u pozostałych uczestników sesji najpóźniej po 10 s, bez ręcznego odświeżania.” | `context/foundation/prd.md:112` | declared | Poll 5000 ms `src/components/play/PlayerBoard.tsx:17` i `src/components/sessions/GmBoard.tsx:10` | Błąd ticku jest pustym `catch` `src/components/play/PlayerBoard.tsx:297`. Widoczność w 10 s jest po stronie przeglądarki. Non-goal v1 wyklucza synchronizację na żywo `context/foundation/prd.md:148`. |
| R-15 | Gracz sesji | „Osoba spoza stołu zgadująca kody sesji nie trafi w aktywną sesję w rozsądnym czasie (< 1 trafienie na 100 000 prób).” | `context/foundation/prd.md:111` | enforced | Alfabet 32 znaków × 6 `src/lib/services/session-code.ts:3` | Szukane `rateLimit\|throttle` w `src/**/*.{ts,tsx}` — zero. Przy jednej aktywnej sesji 100 000 prób nie wypełnia przestrzeni kodu. Licznika prób nie ma. |

Reguły tylko w kodzie (w wymaganiach z tej próbki ich nie ma):

- Co najwyżej 10 nowych miejsc; ponowne wejście tym samym tokenem nie zajmuje miejsca `supabase/migrations/20261011170000_threshold_pattern_rewards.sql:148`. Komentarz SQL sam mówi „Soft”; CHECK na liczbie wierszy nie ma.
- Cudzy MG dostaje `session_not_found`, nie 403 `supabase/migrations/20261011133000_session_close_replaced_by.sql:30`.
- Ciasteczko wycina najstarsze kody powyżej 3500 znaków `src/lib/player-cookie.ts:174`. Bez tokenu kolejny join tworzy nowe miejsce.

## Model vs code drift

Porównanie idzie do najnowszego zdania. Starsze zdanie, które kod już spełnia przez późniejszą decyzję, jest w sekcji nieaktualnych dokumentów. Wiersz z naprawą „dokument” ma cytat tej późniejszej decyzji.

| id | the documents say (newest) | the code does | evidence (path:line) | consequence | fix: code / docs / decision |
| --- | --- | --- | --- | --- | --- |
| D-01 | „Wyjście: plansza N×N z unikalnymi hasłami i losowo rozmieszczonymi nagrodami.” (`context/foundation/prd.md:121`). Późniejszej decyzji, która pozwala sesji bez komórek, nie ma. | `createSession` wstawia `sessions`, potem komórki, pulę i linie osobnymi wywołaniami. Błąd komórek leci wyjątkiem i zostawia wiersz sesji. | `src/lib/services/sessions.service.ts:132` oraz `:157` | W bazie może istnieć sesja, która nie jest planszą. Strona pokazuje 422 i nie sprząta wiersza. | code |
| D-02 | „submit creates a new session, closes the source with `replaced_by_session_id`” (`context/archive/2026-10-11-gm-regenerate-board/plan.md:20`). | Po udanym create close jest w osobnym `try`. Błąd close dopisuje `closeError` i zwraca 201. Poprzedniczka zostaje `active`. | `src/pages/api/sessions/index.ts:67` | Przy stole mogą żyć dwa kody. Gracze na starym kodzie nie widzą następcy, dopóki close nie przejdzie. | code |
| D-03 | Najnowsza decyzja: „this plan keeps new code but softens rejoin via auto-join” i auto-join bez formularza, gdy nick jest w ciasteczku (`context/archive/2026-10-11-gm-regenerate-board/plan.md:16`, `:21`). prd.md nadal: „gracze muszą do niej dołączyć na nowo” (`context/foundation/prd.md:80`). | Przeglądarka woła join następcy, gdy status to `closed`, jest `successorCode` i nick `src/components/play/PlayerBoard.tsx:272`. | `src/components/play/PlayerBoard.tsx:272`; decyzja `context/archive/2026-10-11-gm-regenerate-board/plan.md:16` | Kto czyta FR-007, oczekuje ręcznego wejścia. Kod i plan regeneracji robią wejście same. | docs |
| D-04 | „gracz nie ma tożsamości poza jedną sesją” (`context/foundation/prd.md:142`). prd-v2, nowszy, zostawia to jako non-goal zmiany (`context/foundation/prd-v2.md:122`). Brief dołączenia, starszy niż prd-v2, chce ciasteczka na 400 dni. Żaden z tych tekstów nie uchyla drugiego. | Ciasteczko `rpg_player` ma `maxAge` 34560000 `src/lib/player-cookie.ts:3` i niesie nick oraz `claimToken` między wizytami. | `src/lib/player-cookie.ts:3`; `context/foundation/prd.md:142`; `context/foundation/prd-v2.md:122` | Nie wiadomo, czy pamięć nicku w przeglądarce jest historią gracza, której non-goal zakazuje. | decision |
| D-05 | „kafelek oznacza się kolorem/nickiem gracza” oraz drugi gracz „widzi, że pole jest już zajęte i przez kogo” (`context/foundation/prd.md:55`, `:58`). Późniejszej decyzji, która zdejmuje nick z kafelka, w przeczytanych briefach nie ma (brief 2026-10-14 dotyczy rozmiaru czcionki nagrody). | Zajęte pole gracza pokazuje etykietę nagrody albo nic, nie nick i nie hasło `src/components/play/PlayerBoard.tsx:465`. To samo u MG `src/components/sessions/GmBoard.tsx:294`. Kolor jest klasą tła. Nick jest na liście graczy. | `src/components/play/PlayerBoard.tsx:465`; `src/components/sessions/GmBoard.tsx:294`; `context/foundation/prd.md:55` | Przy stole „przez kogo” jest kolorem i listą, nie nickiem na kafelku. Hasło znika z zajętego pola. | decision |

## Stale documents

- Rodzaj nagrody widoczny od początku w archiwum shape notes (`context/foundation/archive/shape-notes-2026-10-11-1304.md:152`) zastąpiony 2026-10-03 przez mystery-until-claim (`context/foundation/prd.md:88`). Kod trzyma nowsze zdanie (R-06).
- „gracze muszą do niej dołączyć na nowo” (`context/foundation/prd.md:80`, to samo D-03) zastąpione auto-wejsciem w planie regeneracji (`context/archive/2026-10-11-gm-regenerate-board/plan.md:16`). prd.md nie zostało poprawione.
- Zamknięty kod jako „Nie znaleziono sesji” (`context/archive/2026-10-03-player-join-shared-board/plan-brief.md:16`) zastąpione planszą tylko do odczytu (`context/archive/2026-10-11-gm-regenerate-board/plan.md:30`). Kod zwraca `status` `closed` `supabase/migrations/20261011140000_player_board_active_or_closed.sql:47`.
- Kolor 1–16 i „modulo 16” w briefie dołączenia (`context/archive/2026-10-03-player-join-shared-board/plan-brief.md:30`) zastąpione Addendum A: kolory 1–8 po kolei dołączeń (`context/archive/2026-10-03-player-claim-field-reward/plan.md:418`). Kod: `supabase/migrations/20261011170000_threshold_pattern_rewards.sql:153`.

## Ranking

| # | candidate | kind | subdomain | status | related IDs | reason | done when |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Sesja | aggregate | Plansza i zajęcie pola | declared | R-01, R-03, D-01, D-02 | Niezmiennik planszy N×N jest w generatorze, a baza przyjmuje sesję bez komórek. Ta sama ścieżka tworzenia zostawia dwie sesje `active`, gdy zamknięcie poprzedniczki padnie. | Zapytanie o sesje, w których liczba `board_cells` różni się od `size * size`, zwraca zero wierszy także po przerwanym tworzeniu, a nieudane zamknięcie poprzedniczki przy regeneracji zostawia co najwyżej jedną z tych dwóch sesji w `status = 'active'`. |
| 2 | Widoczność zajęcia do 10 s | policy | Plansza i zajęcie pola | declared | R-14 | Poll co 5 s jest jedynym nośnikiem NFR, a błąd ticku nic nie zostawia po sobie. Kryterium główne nadal mówi o ręcznym odświeżeniu (`context/foundation/prd.md:39`); NFR jest ostrzejsze. | Drugi uczestnik tej samej sesji widzi zajętość pola bez ręcznego odświeżenia w ciągu 10 s, także gdy jedna odpowiedź pollu zakończy się błędem. |
| 3 | Gracz sesji | aggregate | Wejście do stołu | declared | R-10, D-04, Q-02 | Non-goal v1 i v2 mówi o tożsamości tylko w sesji, a przeglądarka pamięta nick i token 400 dni i sama wchodzi do następcy. | W `context/foundation/prd.md` jest jedno zdanie, które albo wpuszcza ciasteczko nicku na 400 dni, albo go zakazuje; wyszukanie `34560000` i tego zdania wskazuje tę samą decyzję. |
| 4 | Postęp nagród | aggregate | Nagroda z reguły | enforced | R-08, R-09 | Reguła kompletującego i progu jest egzekwowana, w dwóch miejscach: RPC i `reward-progress.ts`. Rozjazd kopii byłby cichy. | Wyszukanie progu „latest `claimed_at`” / `isLaterClaim` znajduje jedną implementację, albo jeden test woła RPC i `deriveRewardProgress` na tym samym układzie pól i dostaje tego samego kompletującego. |
| 5 | Pole | aggregate | Plansza i zajęcie pola | enforced | R-05, R-06, R-07, D-05 | Pierwszeństwo zajęcia jest twarde w jednym `UPDATE`. Zostaje pytanie, czy kafelek niesie nicka (D-05), nie czy dwóch graczy może mieć to samo pole. | Dwa równoległe zajęcia tej samej pozycji kończą się jednym `claimed` i jednym `conflict`, a `claimed_by_player_id` zostaje przy pierwszym graczu. |

**#1:** Sesja jest kandydatem pierwszym, bo status `declared` i subdomena Core wygrywają z resztą rankingu, a skutek jest przy stole, nie w nazwie. Plansza, która jest celem produktu (`context/foundation/prd.md:121`), może nie powstać, choć wiersz sesji już jest (`src/lib/services/sessions.service.ts:132`). Regeneracja, która ma zamknąć starą sesję (`context/archive/2026-10-11-gm-regenerate-board/plan.md:20`), potrafi ogłosić sukces i zostawić dwa kody `active` (`src/pages/api/sessions/index.ts:67`). Zajęcie pola, twardszy strażnik produktu, jest już w SQL i dlatego jest niżej.

## Questions

| id | question | who can answer | unblocks |
| --- | --- | --- | --- |
| Q-01 | Czy FR-014 (nagroda drużynowa) zostaje celem produktu, czy nice-to-have zaparkowanym na stałe? | właściciel produktu | T-28, B-03 |
| Q-02 | Czy ciasteczko nicku i tokenu na 400 dni jest pamięcią przeglądarki dozwoloną przy non-goalu „tożsamość tylko w sesji”, czy ten non-goal ma ciasteczko wykluczyć? | właściciel produktu | D-04, R-10, pozycja 3 rankingu |
| Q-03 | Czy zajęty kafelek ma pokazywać nicka (i zostawiać hasło), czy kolor plus lista graczy i etykieta nagrody wystarczają? | właściciel produktu | D-05 |
| Q-04 | Czy limit 10 graczy jest regułą stołu, czy technicznym sufitem do zmiany? | właściciel produktu | reguła tylko w kodzie `session_full` |
| Q-05 | Czy `SUPABASE_KEY` w środowisku, na którym działa aplikacja, jest kluczem roli `anon` (RLS działa przy insertach create), czy rolą omijającą RLS? | operator wdrożenia | pewność R-02 i R-05 poza funkcjami `SECURITY DEFINER` |

## Unknowns and limitations

- Oba pliki wymagań mają `status: draft`. prd.md (2026-09-18, ostatni commit treści 2026-10-03) jest wizją produktu. prd-v2 (2026-10-11) jest zmianą i powtarza cel jednym zdaniem. README w korzeniu opisuje szablon startowy, nie stół.
- Narracja: 14 plików w całości (oba zestawy shape notes, roadmapa, briefy biznesowe). 22 zmiany tylko z tytułu. Plany UI, research i recenzje implementacji nie były czytane w całości. Reguła, która żyje tylko tam, mogła nie wejść do słownika.
- Nie porównano linia po linii RPC `get_player_reward_inputs` z `deriveRewardProgress` (R-08, R-09).
- `wrangler.jsonc` jest poza zakresem kodu tej destylacji. Nie sprawdzono, czy Worker ma cron.
- Wartości sekretu `SUPABASE_KEY` nie czytano (Q-05).
- Brak warstwy domeny jest stanem kodu, nie luką dowodu.
