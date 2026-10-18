# Evidence: language in the code

Zakres: całe repozytorium, warstwy z inwentarza — persistence (`supabase/migrations/*.sql`, kolumny/tabele w `supabase/seed.sql`), typy (`src/types.ts`, `src/db/database.types.ts`), operacje (`src/lib/services`, `src/lib/schemas`, wybrane `src/lib/*.ts` poza `utils`/`report-error`), wejścia (`src/pages/api`, `src/pages`, `src/middleware.ts`), UI (`src/components`, `src/pages`, `src/layouts`). Pominięte ścieżki z `0-sources.md` (w tym `context/**`, README, AGENTS, CLAUDE, `.cursor`, testy jako warstwa słownika). Teksty `INSERT` w seedzie to treść katalogu, nie terminy schematu.

Wyszukania (ripgrep): `CREATE TABLE|FUNCTION|POLICY`, `status`, `RAISE EXCEPTION`, etykiety UI (nagroda, sesja, plansza, hasło, pole, MG, bingo), eksporty `GET|POST|DELETE` w `src/pages/api`, `status = 'active'` w migracjach, `from("sessions")` w serwisie. Otwarte pliki tylko tam, gdzie trafiło wyszukanie. Próbkowane, nie przeczytane w całości: późniejsze wersje RPC (`get_player_reward_inputs` w 2026101117*), strony kitchen-sink (cytowane tylko gdy niosą etykietę), testy jednostkowe.

Osobnego pakietu domeny nie ma: glob `src/**/domain/**` → 0 plików. `src/types.ts` to aliasy wierszy tabel; `database.types.ts` ma `Enums: { [_ in never]: never }` (`src/db/database.types.ts:367`).

Etykiety: evidence, o ile nie oznaczono **inference** albo **comment**.

## Concepts and their names across layers

| concept | persistence | domain type | operations | entry points | UI | user-facing label (language) |
| --- | --- | --- | --- | --- | --- | --- |
| Produkt | — | — | — | `src/layouts/Layout.astro:16` domyślny `title` | `src/components/Welcome.astro:8` | „RPG Bingo” (pl); opis „Bingo przy stole RPG” `Welcome.astro:10` |
| Sesja | tabela `sessions` `supabase/migrations/20260927143000_sessions_and_board_cells.sql:4` | `Session` `src/types.ts:5`; `SessionStatus` `src/types.ts:9` | `createSession`, `listSessionsForGm` `src/lib/services/sessions.service.ts:81`, `:200` | `POST` `src/pages/api/sessions/index.ts:36`; `DELETE` `src/pages/api/sessions/[id].ts:19`; strony `/dashboard`, `/sessions/new`, `/sessions/[id]` | `DashboardPanel.astro:39`, `NewSessionForm` | „Panel MG”, „Nowa sesja”, „Sesja {code}” (`src/pages/sessions/[id].astro:107`) (pl) |
| Kod sesji | kolumna `code`, CHECK 6 znaków alfabetu bez I/O/0/1 `20260927143000_sessions_and_board_cells.sql:7` | `SESSION_CODE_LENGTH` `src/types.ts:15` | `generateSessionCode`, `SESSION_CODE_PATTERN` `src/lib/services/session-code.ts:5`, `:7` | `GET /play?code=` → redirect `/play/${code}?join=1` `src/pages/play/index.astro:4-8`; `buildPlayerJoinUrl` `src/lib/player-join-url.ts:5` | `JoinSessionForm.tsx:42`, `SessionJoinQr.tsx:44` | „Kod sesji” (pl) |
| Plansza (rozmiar) | `sessions.size` CHECK 3–5 `20260927143000_sessions_and_board_cells.sql:8`; `board_cells` `:16` | `BoardSize` `src/types.ts:10`; `BOARD_SIZES` `:14` | `generateBoard` `src/lib/services/board-generator.ts:49` | `GET` `src/pages/api/sessions/[id]/board.ts:17`; `GET` `src/pages/api/play/board.ts:18` | `BoardGrid.astro:6`; `NewSessionForm.tsx:216` | „Rozmiar planszy”, „Generuj planszę” `NewSessionForm.tsx:365`, „Wygeneruj nową planszę” `GmRegenerateControls.tsx:58` (pl) |
| Hasło na planszy (fraza) | tabela `phrases.text` `20260927134220_phrases_and_rewards.sql:4-6`; kopia na `board_cells.phrase` `20260927143000_sessions_and_board_cells.sql:20` | `Phrase` `src/types.ts:3`; `CustomPhraseInput` `:17` | `normalizePhrase` `board-generator.ts:19`; `customPhrases` w `createSessionSchema` `src/lib/schemas/session.ts:4` | komunikat `POOL_TOO_SMALL` `src/pages/api/sessions/index.ts:23` | `NewSessionForm.tsx:233` | „Własne hasła”, „Wpisz hasło…”, „Gwarantowane na planszy” `NewSessionForm.tsx:249`, `:263` (pl). Teksty w `seed.sql:4-37` to katalog, nie nazwy. |
| Nagroda (katalog) | `rewards` (`slug`, `label`, `description`) `20260927134220_phrases_and_rewards.sql:11-15` | `Reward`, `RewardRef` `src/types.ts:4`, `:12` | odczyt `rewards` w `createSession` `sessions.service.ts:93-95`; błąd `UNKNOWN_REWARD` `:33` | „Nieznana nagroda” `src/pages/api/sessions/index.ts:95` | etykieta z `reward.label` | Seed (katalog): slugi `inspiration`, `item`, `side-quest`, `clue`, `npc-help`, `experience` i polskie `label`/`description` `supabase/seed.sql:39-68`. UI domyślnie ustawia count 3 dla `slug === "inspiration"` `NewSessionForm.tsx:42` (**evidence** użycia sluga). |
| Nagroda na polu | `board_cells.reward_id` `20260927143000_sessions_and_board_cells.sql:21` | `fieldRewards` `src/types.ts:53`; `hasReward` `src/types.ts:139` | przypisanie w `generateBoard` `board-generator.ts:107-123`; klucz JSON `field_rewards` `sessions.service.ts:337` | — | `NewSessionForm.tsx:292` | „Nagrody na polach”; dopisek „To nie jest próg ani wiersz/kolumna.” `NewSessionForm.tsx:294` (pl) |
| Linia (wiersz/kolumna) | `board_lines.axis` CHECK `('row','column')` `20261011170000_threshold_pattern_rewards.sql:21-23`; `session_reward_pool.kind` zawiera `'line'` `:16` | `LineAxis` `src/types.ts:11`; `BoardLineSlot`, `EarnedLineReward` `:27`, `:34` | `drawLineRewards` `board-generator.ts:129`; `buildLineSlots` `src/lib/services/line-slots.ts:52` | pole `lineRewardIds` w `createSessionSchema` `src/lib/schemas/session.ts:28` | `RewardRulesFields.tsx:88` | „Nagrody za wiersz lub kolumnę” (pl). Identyfikatory osi zostają `row` / `column`. |
| Próg | `sessions.threshold_count` `20261011170000_threshold_pattern_rewards.sql:5`; `session_players.threshold_reward_id` `:12`; `kind` `'threshold'` `:16` | `thresholdCount`, `thresholdReward` `src/types.ts:45-46`; `SessionRewardRules` `:56` | `deriveRewardProgress` `src/lib/services/reward-progress.ts:34`; losowanie przy join `kind = 'threshold'` `20261011170000_threshold_pattern_rewards.sql:155-161` | `thresholdRewardIds` / `thresholdCount` w schemacie `session.ts:35-42` | `RewardRulesFields.tsx:103`, `:110` | „Nagroda za liczbę pól (próg …)”, „Próg — liczba pól (N)” (pl) |
| Gracz przy stole | `session_players` (`nick`, `color`, `claim_token`) `20261003140000_session_players_and_claims.sql:5-8`; `claim_token` `20261003190000_player_claim_token.sql:5`; kolor 1–8 `20261003180000_player_colors_8.sql:11` | `SessionPlayer` `src/types.ts:7`; `PlayerIdentity` `src/lib/player-cookie.ts:11`; cookie `rpg_player` `:3` | `joinSessionPlayer` `sessions.service.ts:622`; SQL `join_session_player` `20261011170000_threshold_pattern_rewards.sql:84` | `POST` `src/pages/api/play/join.ts:33`; strona `/play/[code]` | `JoinNickForm.tsx:31`, `PlayerRosterList.tsx:111` | „Nick”, „Gracze”, „Wejdź” `JoinNickForm.tsx:45`; „Nikt jeszcze nie dołączył” `PlayerRosterList.tsx:113` (pl). „Nick” nie jest tłumaczone. |
| Zajęcie pola | `claimed_by_player_id`, `claimed_at` `20261003140000_session_players_and_claims.sql:32-33`; RPC `claim_board_cell` zwraca `status` `'claimed'` \| `'conflict'` `20261003190000_player_claim_token.sql:177-207`; `undo_board_cell` `20261003200000_undo_board_cell.sql:4` | `ClaimOccupant`, `ClaimSuccessResponse`, `ClaimConflictResponse` `src/types.ts:160-177`; wynik serwisu `{ status: "claimed" \| "conflict" }` `sessions.service.ts:57-58` | `claimBoardCell` `:665`, `undoBoardCell` `:803` | `POST` `src/pages/api/play/claim.ts:19`; `POST` `src/pages/api/sessions/[id]/undo-claim.ts:20` | `PlayerBoard.tsx:352`, `:481`; `GmBoard.tsx:327` | „Pole jest zajęte”, „Zajmij pole: …”, „Cofnij oznaczenie” (pl) |
| Prowadzący | kolumna `gm_id` → `auth.users` `20260927143000_sessions_and_board_cells.sql:6`; polityki `gm_id = auth.uid()` `:33`, `:39` | brak typu `Gm`; parametr `gmId` | `listSessionsForGm`, `getSessionCodeForGm` `sessions.service.ts:200`, `:211` | `PROTECTED_ROUTES` `["/dashboard","/sessions"]` `src/middleware.ts:5` | komponenty `GmBoard`, `GmRegenerateControls`, `GmSuccessorNotice` | „MG” w „Panel MG” `src/pages/dashboard/index.astro:30` i `Welcome.astro:10` (pl). Identyfikator kodu zostaje `gm`. |
| Zamknięcie i następca | `replaced_by_session_id` `20261011133000_session_close_replaced_by.sql:5`; funkcja `close_session_as_replaced` `:8`; `delete_session` `20261011163400_delete_session.sql:4` | `successorCode` `src/types.ts:149`; `replaceSessionId` `src/types.ts:70`; `CloseErrorReason` `:73` | `closeSessionAsReplaced` `sessions.service.ts:750`; `deleteSession` `:786` | `POST` `src/pages/api/sessions/[id]/close.ts:20`; body `replacedBySessionId` `src/lib/schemas/session-close.ts:4` | `GmSuccessorNotice.astro:11`; `PlayerBoard.tsx:410-415`; `CloseRetryBanner.tsx:80` | „Sesja zamknięta — następczy kod graczy”, „Sesja zamknięta”, „Nowy kod”, „Zamknij poprzednią sesję” `CloseRetryBanner.tsx:92` (pl) |
| Konto (logowanie) | `auth.users` tylko jako cel FK `gm_id` (wyżej) | `context.locals.user` `src/middleware.ts:18` | — (klient Supabase) | `POST /api/auth/signin|signup|signout` | `SignInForm.tsx:127`, `:143`; `src/pages/auth/signin/index.astro:15` | „E-mail”, „Hasło”, „Zaloguj się”, „Załóż konto”, „Wyloguj” `DashboardActions.tsx:40` (pl) |

## One concept, many names

- **Prowadzący.** Persistence i serwis: `gm_id` / `gmId` / prefiks komponentów `Gm*`. UI i copy: „MG” (`Welcome.astro:10`, `dashboard/index.astro:30`). **evidence.** Brak typu `GameMaster`.
- **Sesja i plansza.** Komentarz migracji: „Session (= one board, one code)” `20260927143000_sessions_and_board_cells.sql:1` (**comment**). Typ i tabela: `Session` / `sessions`. UI rozdziela „sesja” (kod, lista, zamknięcie) i „plansza” (siatka, generowanie). **evidence** dwóch słów na ten sam rekord; **inference**: plansza = komórki tej sesji, nie drugi agregat (nie ma tabeli `boards`).
- **Pole siatki.** Tabela `board_cells`, typ `BoardCell` / `PlayerBoardCell`, UI „pole” („Zajmij pole”, „Nagrody na polach”, „Pól z nagrodą” `NewSessionForm.tsx:331`). Postęp nagród z komórek: `fieldRewards` / SQL-owy klucz `field_rewards`. Komentarz typu: „reveal Pole on the claimed cell” `src/types.ts:51` (**comment**, słowo „Pole” po angielsku w komentarzu). **evidence.**
- **Hasło-wyzwanie.** Katalog i kolumna: `phrase` / `phrases`. Formularz tworzenia: „hasło” / „Własne hasła”. **evidence.** Zderzenie z hasłem konta — niżej.
- **Następca.** Kolumna `replaced_by_session_id`, argument SQL `p_replaced_by`, pole komendy `replaceSessionId`, pole odpowiedzi `successorCode` / kolumna RPC `successor_code` `database.types.ts:327`, UI „następczy kod” i „Nowy kod”. **evidence.**
- **Zajęcie.** Czasownik SQL/TS `claim` / `undo`; UI gracza „zajmij”; UI MG „oznaczenie” (`GmBoard.tsx:327` „Cofnij oznaczenie”). **evidence.**

## One name, many concepts

- **„Hasło” (pl).** (1) Fraza na planszy: „Własne hasła”, „Wpisz hasło…” `NewSessionForm.tsx:233`, `:249`. (2) Hasło konta: label „Hasło” `SignInForm.tsx:143`, „Potwierdź hasło” `SignUpForm.tsx:144`. Identyfikatory się nie mieszają (`phrase` vs `password`). **evidence.**
- **`status`.** (1) `sessions.status` ∈ `active` \| `closed` `20260927143000_sessions_and_board_cells.sql:9`, typ `SessionStatus` `src/types.ts:9`. (2) Wynik `claim_board_cell`: `'claimed'` \| `'conflict'` `20261003190000_player_claim_token.sql:179`, `:207` — nie jest kolumną sesji. (3) Kody błędów serwisu (`SESSION_NOT_FOUND` itd.) to osobne unie, nie ta kolumna. **evidence.**
- **`code`.** (1) Publiczny kod dołączenia, 6 znaków. (2) Kody błędów (`BoardGenerationErrorCode`, `CloseErrorReason`, `JoinSessionPlayerErrorCode`). **evidence** homonimu w identyfikatorach.
- **`player`.** `session_players` / cookie `rpg_player` = osoba przy planszy (nick, kolor). `auth` user / `gm_id` = konto prowadzącego. Gracz nie ma wiersza w `auth.users` w przejrzanym schemacie. **evidence** rozdziału; **unknown**, czy konto może też być graczem — wyszukanie nie łączy `user.id` z `session_players`.
- **„Pole”.** W UI produkcji: komórka planszy. W opisach kitchen-sink logowania: „Pole e-mail” `src/pages/auth/signin/kitchen-sink.astro:20` — etykieta galerii dev, nie plansza. **evidence.**

## Implicit concepts

- **Gwarantowane hasło.** Flaga `CustomPhraseInput.guaranteed` `src/types.ts:19` i checkbox „Gwarantowane na planszy”. Nie ma kolumny `guaranteed` (wyszukanie CREATE/ALTER w migracjach nie dodaje takiej kolumny; fraza ląduje jako zwykłe `board_cells.phrase`). **evidence** braku kolumny w przejrzanym DDL; po zapisie sesji cecha znika.
- **Tajemnica nagrody.** `PlayerBoardCell.hasReward` bez `reward`, dopóki pole wolne `src/types.ts:133-140` (**comment** w JSDoc + pola typu). MG widzi etykietę od razu (`BoardGrid` / `GmBoard`). **evidence** asymetrii nazw (`hasReward` vs odkryty `reward.label`).
- **Limit stołu.** Komentarz „Soft table size: max 10” i `IF v_join_ordinal > 10` → wyjątek `session_full` `20261011170000_threshold_pattern_rewards.sql:148-151` (**comment** + evidence progu). UI: „Stół jest pełny (max 10 graczy).” `JoinNickForm.tsx:42`. Kolor: `((ordinal - 1) % 8) + 1` `:153` — 8 kolorów, do 10 miejsc. Nie ma tabeli `seats`.
- **`claim_token`.** Sekret w cookie (`PlayerIdentity.claimToken` `player-cookie.ts:14`, komentarz „never expose on player poll” **comment**). Roster gracza celowo bez id wiersza `src/types.ts:113` (**comment**).
- **Pula reguł.** `session_reward_pool` to zbiór id nagród z `kind`, nie trzeci byt „pula” w UI. UI mówi „lista” / „Nic nie zaznaczono” `RewardRulesFields.tsx:90-91`.
- **Bingo jako mechanika.** Słowo „Bingo” jest nazwą produktu (`Welcome.astro:8-10`, tytuł layoutu). Nie ma typu, tabeli ani trasy `bingo` (wyszukanie `[Bb]ingo` w `src/**/*.{ts,tsx,astro}`). Kitchen-sink: „planszy bingo” `src/pages/sessions/board/kitchen-sink.astro:574`. **evidence.**
- **„Legenda nagród”.** Wyszukanie `Legenda` w `src` trafia tylko w `sessions/board/kitchen-sink.astro:711`. Nie cytuję tego jako etykiety produkcji.

## States and transitions

Jedyny stan sesji w CHECK: `'active'` (DEFAULT) i `'closed'` `20260927143000_sessions_and_board_cells.sql:9`. Brak typu enum w Postgres (`database.types.ts:367`).

- Wejście w `active`: insert sesji nie ustawia `status` `sessions.service.ts:134-139` — zostaje DEFAULT. **evidence.**
- `active` → `closed`: jedyny `SET status = 'closed'` w przejrzanych migracjach, razem z `replaced_by_session_id`, tylko gdy wiersz jest `active` `20261011133000_session_close_replaced_by.sql:52-57`. Odrzucenia: `session_not_found`, `session_not_active`, `replacement_not_found` `:27-49`.
- Powrót do `active`: wyszukanie `status = 'active'` w `supabase/migrations` daje wyłącznie predykaty `AND`/`WHERE`, nie `SET`. W `src/**/*.ts(x)` brak przypisania `status: "active"|"closed"`. **evidence** zakresu wyszukania, nie twierdzenie o całym SQL poza migracjami.
- Skutki stanu: join i claim i undo wymagają `status = 'active'` (ostatnie definicje: join `20261011170000_threshold_pattern_rewards.sql:118`, claim `20261003190000_player_claim_token.sql:148`, undo `20261003200000_undo_board_cell.sql:29`). Odczyt planszy i rosteru dopuszcza `status IN ('active','closed')` `20261011140000_player_board_active_or_closed.sql:47`.
- Etykiety: „Aktywna” / „Zamknięta” `src/pages/sessions/[id].astro:58` i `DashboardSessionList.tsx:33`; filtr „Pokaż zamknięte” `:101`.
- Usunięcie: `delete_session` (wyjątek `session_not_found`) i `DELETE` API — znika z listy, to nie jest trzeci status. **evidence** nazwy operacji; treść funkcji poza sygnaturą i wyjątkami nie była czytana linia po linii.
- Stan pola (osobny od statusu sesji): para `claimed_by_player_id` + `claimed_at` albo oba NULL `20261003140000_session_players_and_claims.sql:36-39`. Claim na wolne pole → `'claimed'`; na zajęte → `'conflict'` z `occupant_nick` / `occupant_color`. Undo czyści parę claim, tylko na sesji `active`.

## Where business logic lives

Osobnej warstwy domeny nie ma (glob `src/**/domain/**` = 0). Reguły siedzą w SQL, serwisach, schematach zod i UI.

- **Sesja / kod / właściciel:** insert i unikalność kodu w `sessions.service.ts` (`CODE_COLLISION` `:197`); kształt kodu w SQL CHECK i `SESSION_CODE_PATTERN`; właściciel w RLS `gm_id = auth.uid()`.
- **Skład planszy:** `generateBoard` / `drawLineRewards` w `board-generator.ts` (czysty TS, przed zapisem). Walidacja liczb w `createSessionSchema` `session.ts:45-78`.
- **Join, kolor, cap 10, losowanie progu na gracza:** funkcja SQL `join_session_player` (ostatnia treść w `20261011170000_threshold_pattern_rewards.sql`).
- **Claim first-wins i undo:** SQL `claim_board_cell`, `undo_board_cell`. Serwis tylko mapuje wiersz wyniku `sessions.service.ts:665-704`.
- **Postęp nagród (linie, próg, field):** TS `deriveRewardProgress` `reward-progress.ts:34` i `buildLineSlots` `line-slots.ts:52` dla widoku MG; dla gracza RPC `get_player_reward_inputs` (kolejne `CREATE OR REPLACE` aż do `20261011173000_player_reward_inputs_line_slots.sql`). **inference:** dwie implementacje tej samej reguły — nie porównywano ich treści w tym przebiegu.
- **Zamknięcie z następcą:** SQL `close_session_as_replaced`; komunikaty po polsku w `src/lib/close-error-messages.ts:3-7`.
- **Tożsamość gracza:** cookie i normalizacja nicka w `src/lib/player-cookie.ts` (1–24 znaki `:8-9`), nie w tabeli poza `nick text NOT NULL`.

## Unknowns

- Pełna treść ostatnich `get_player_reward_inputs` / `get_session_players_by_code` nie była czytana poza sygnaturami, kluczami JSON widocznymi w serwisie i predykatami `status`. Nazwy kolumn zwracanych: `database.types.ts:315-364`.
- Czy `delete_session` kasuje kaskadą komórki i graczy — w tym przebiegu nie otwarto ciała funkcji poza `RAISE EXCEPTION 'session_not_found'`.
- Słownik testów (`src/**/*.test.ts`, `tests/**`) nie był zbierany. Trafienia przy okazji (np. host `bingo.example` w `player-join-url.test.ts`) nie wchodzą do pojęć.
- Galerie `/kitchen-sink` zawierają copy zbliżone do produkcji; do etykiet wzięto komponenty używane na stronach, nie opisy sekcji sinka, z wyjątkami oznaczonymi wyżej.

## Commands

Przeszukania ripgrep (narzędzie wyszukiwania repo, odpowiednik `rg`):

- `CREATE TABLE|CREATE TYPE|CREATE OR REPLACE FUNCTION|CREATE FUNCTION|CREATE POLICY|ALTER TABLE|ADD COLUMN|CHECK \(` w `supabase/**/*.sql`
- `^export (type|interface|enum|const)` w `src/types.ts`; tabele w `src/db/database.types.ts`
- `^export (async )?function|^export const|^export type` w `src/lib/**/*.ts`
- `status =` / `RAISE EXCEPTION` w `supabase/migrations`
- etykiety i terminy `GM|bingo|hasło|nagrod|sesj|plansz|pole|wiersz|gracz|nick` w `src/**/*.{ts,tsx,astro}`
- `^export const (GET|POST|DELETE|PUT|PATCH)` w `src/pages/api`
- `status = 'active'` w migracjach; `from("sessions")` w `sessions.service.ts`
- `[Bb]ingo` w `src/**/*.{ts,tsx,astro}`
- glob `src/**/domain/**`, `supabase/migrations/*.sql`, `src/pages/**`, `src/components/**`, `src/lib/services/**`, `src/lib/schemas/**`
