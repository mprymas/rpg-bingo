---
title: Sesja powstaje tylko jako kompletna plansza — plan agregatu
created: 2026-10-18
type: refactor-plan
---

# Sesja powstaje tylko jako kompletna plansza

Plan refaktoru. Nie zmienia kodu produkcyjnego. Cytaty `plik:linia` są sprawdzone w tym przebiegu na drzewie roboczym.

Wybrany niezmiennik: **sesja istnieje tylko jako kompletna plansza**. Albo commit zostawia spójną całość (wiersz sesji, dokładnie `size²` pól na pozycjach `0 .. size²−1`, unikalne hasła, reguły nagród zgodne z poleceniem), albo nie zostaje żaden wiersz tej sesji. Nielegalna próba zatrzymuje operację nazwanym błędem.

Agregat-strażnik: **`Session`**. Nazwa wzięta z kodu i ze schematu, nie z góry. Komentarz migracji utożsamia sesję z jedną planszą i jednym kodem (`supabase/migrations/20260927143000_sessions_and_board_cells.sql:1`). Tabela to `sessions` (`:4`), typ wiersza to `Session` (`src/types.ts:5`). Osobnej tabeli `boards` nie ma. W dokumentach „plansza” jest siatką tej sesji, nie drugim bytem (`context/foundation/prd.md:24`, `:119-121`).

## Krok 0 — Kontekst

Produkt: RPG Bingo. Wizja: wspólna plansza na sesję papierowego RPG, hasła z bazy i własne MG, pole zajęte raz, nagroda na widocznym polu, żeby inspiracja wynikała z reguły, a nie z uznania MG (`context/foundation/prd.md:22-24`, powtórzone w `context/foundation/prd-v2.md:22`).

Wyjście logiki biznesowej jest zapisane wprost: z puli haseł i puli nagród aplikacja losowo składa planszę N×N; wyjście to plansza N×N z unikalnymi hasłami i losowo rozmieszczonymi nagrodami (`context/foundation/prd.md:119-121`). Primary success zaczyna się od tego, że MG generuje planszę 5×5 (`context/foundation/prd.md:39`).

Stack: Astro 7 SSR, React 19, TypeScript, Supabase (Postgres), Cloudflare Workers (`context/foundation/prd-v2.md:24-26`). Osobnej warstwy domeny nie ma (`src/**/domain/**` — brak plików). Reguły żyją w:

| Warstwa | Gdzie |
| --- | --- |
| Wejście HTTP | `src/pages/api/**`, `src/middleware.ts`; kształt żądania w `src/lib/schemas/**` (zod) |
| Aplikacja | `src/lib/services/**` — w tym skład planszy (`board-generator.ts`) i zapis (`sessions.service.ts`) |
| Typy | `src/types.ts` — aliasy wierszy, nie agregaty |
| Persystencja | `supabase/migrations/*.sql`; atomowe operacje, które już są, to jedna funkcja PL/pgSQL (`SECURITY DEFINER`), np. `claim_board_cell` (`supabase/migrations/20261003190000_player_claim_token.sql:134-136`) |
| UI | strony Astro i wyspy React; część reguł tylko wyłącza kontrolkę |

Klient danych nie otwiera transakcji wieloinstrukcyjnej. W `src/**` nie ma wywołania transakcji; zapisy wielotabelowe idą kolejnymi `.insert`, a spójne zapisy idą przez `.rpc` (wzorzec w `src/lib/services/sessions.service.ts:634`, `:669`, `:754`, `:790`, `:807`).

Testy: Vitest, unit obok modułu (`src/**/*.test.ts`), integracja HTTP w `tests/integration/**/*.test.ts` (`context/foundation/test-plan.md:1-15`). Dyscyplina projektu to „najtańszy test, który daje sygnał”, nie obowiązkowe red-green dla każdej zmiany. Czysta reguła planszy już ma unit (`src/lib/services/board-generator.test.ts:4-20`) i integrację ścieżki sukcesu (`tests/integration/create-session-board.test.ts:81-111`). Fazy agregatu idą test-first, bo runner i ten podział już są.

## Krok 1 — Niezmienniki

Reguły, które w tej domenie mają być zawsze prawdziwe. Status egzekucji jest skrótem; uzasadnienie jest w kroku 2.

| ID | Reguła | Źródło dokumentu | Źródło kodu |
| --- | --- | --- | --- |
| I1 | Pole należy do pierwszego gracza, który je oznaczył. Kolejne kliknięcie nie zmienia stanu. Nagroda tego pola przypada tylko jemu. | `context/foundation/prd.md:45`, `:121`, `:57-58` | `UPDATE … WHERE claimed_by_player_id IS NULL` w `supabase/migrations/20261003190000_player_claim_token.sql:168-174`; brak wiersza przy zajętej pozycji daje status `conflict` (`:205-207`) |
| I2 | Sesja jest planszą N×N: dokładnie `size²` unikalnych haseł, nagrody pól rozmieszczone przy składaniu, reguły linii i progu zapisane razem z planszą. Częściowy zapis nie jest sesją. | `context/foundation/prd.md:119-121`, FR-004 i FR-005 (`:74-77`) | Generator zwraca dokładnie `size * size` albo rzuca (`src/lib/services/board-generator.ts:57`, `:82-93`, `:115-116`). Zapis to cztery osobne inserty (`src/lib/services/sessions.service.ts:132-191`). Baza pilnuje unikalności pozycji i hasła (`supabase/migrations/20260927143000_sessions_and_board_cells.sql:22-23`), nie liczy komórek |
| I3 | Gracz widzi, że pole ma nagrodę, a rodzaj poznaje po zajęciu. MG widzi typ od początku. | `context/foundation/prd.md:89`, `:121` | Odczyt gracza: `has_reward` zawsze, `reward_slug` / `reward_label` tylko gdy pole jest zajęte (`supabase/migrations/20261011140000_player_board_active_or_closed.sql:31-38`). Odczyt MG bierze `slug` i `label` nagrody na każdej komórce (`src/lib/services/sessions.service.ts:413-416`) |
| I4 | Cofnięcie oznaczenia przez MG zwalnia pole i unieważnia nagrodę z tego oznaczenia. | `context/foundation/prd.md:92`, `:123` | `undo_board_cell` zeruje `claimed_by_player_id` i `claimed_at`, nie rusza `reward_id` (`supabase/migrations/20261003200000_undo_board_cell.sql:1`, `:39-45`). Linie i próg są liczone z aktualnych zająć (`src/lib/services/reward-progress.ts:56-88`), więc cofnięcie odbiera je przy następnym liczeniu |
| I5 | Nowa plansza ma nowy kod; gracze wchodzą do niej na nowo. Zamknięcie poprzedniej jest skutkiem świadomej podmiany. | `context/foundation/prd.md:80-81` | Close jest osobnym RPC po udanym create. Błąd close nie cofa nowej sesji: API zwraca 201 i dopisuje `closeError` (`src/pages/api/sessions/index.ts:67-89`) |
| I6 | Jedna sesja ma jednego MG. | `context/foundation/prd.md:145` | `gm_id uuid NOT NULL` (`supabase/migrations/20260927143000_sessions_and_board_cells.sql:6`); polityki `gm_id = auth.uid()` (`:33-39`) |
| I7 | Dołączyć i zająć pole można tylko w sesji `active`. | Skutek FR-007 i rozgrywki na „aktywnej sesji” (`context/foundation/prd.md:53`, `:80-81`) | Join wymaga `status = 'active'` (`supabase/migrations/20261011170000_threshold_pattern_rewards.sql:114-122`); claim tak samo (`supabase/migrations/20261003190000_player_claim_token.sql:147-148`) |
| I8 | Nowe reguły (próg, linia) są opcjonalne. Sesja bez nich jest legalna. Próg, jeśli jest, leży między 1 a `size²`. | `context/foundation/prd-v2.md:96`, `:106` | `CHECK (threshold_count IS NULL OR threshold_count BETWEEN 1 AND (size * size))` (`supabase/migrations/20261011170000_threshold_pattern_rewards.sql:8-9`); pusta lista linii daje zero wierszy (`src/lib/services/board-generator.ts:134`) |
| I9 | Aplikacja nie weryfikuje wykonania zadania. Oznaczenie robi gracz po słownym uznaniu MG. | `context/foundation/prd.md:143`, `:135` | Brak ścieżki „MG zatwierdza pole” w API claim. To niezmiennik negatywny: kod go dotrzymuje przez brak mechanizmu, nie przez strażnika |

I1 jest rdzeniem wizji i jest już domknięty jednym predykatem wiersza. I2 jest wyjściem tej samej logiki biznesowej i nie jest domknięty przy zapisie. Dalej wybór pada na I2.

## Krok 2 — Klasyfikacja i wybór

Oś (a): rdzeń sensu produktu, wobec wizji „plansza, z której nagroda wynika z reguły”. Oś (b): w ilu warstwach reguła dziś żyje. Oś (c): egzekwowany (złamanie zatrzymuje zapis), deklarowany (tekst, test ścieżki sukcesu albo UI), naruszalny (da się zostawić stan, w którym reguła jest fałszywa).

| ID | (a) rdzeń | (b) rozsmarowanie | (c) egzekucja |
| --- | --- | --- | --- |
| I1 | Najwyższy. Guardrail i US-01. Bez tego nie ma „pole zajęte raz”. | SQL (predykat), serwis (mapowanie statusu), zod (pozycja 0..24, szersza niż `size²` dla 3×3 i 4×4), UI (przycisk tylko na wolnym polu). Zapis i tak rozstrzyga SQL | Egzekwowany. Drugi gracz dostaje `conflict` i nie nadpisuje wiersza |
| I2 | Najwyższy na równi z I1 jako przedmiot gry: Business Logic nazywa wyjściem planszę N×N. Bez niej I1 nie ma pól. Test-plan stawia „niekompletna plansza, na której stół gra” jako ryzyko nr 1 (`context/foundation/test-plan.md:42`) | Generator, zod, formularz, cztery inserty, dwie strony HTML (liczą komórki), dwa GET-y (nie liczą), SQL (UNIQUE, bez licznika) | Naruszalny. Porażka insertu komórek, puli albo linii zostawia sesję. Strona MG ogłasza komplet, gdy liczba wierszy wynosi `size²`, nawet gdy linii nie ma |
| I3 | Wysoki (FR-010, must-have), węższy niż skład planszy | Odczyt SQL dla gracza, odczyt MG, render | Egzekwowany na projekcji odczytu gracza |
| I4 | Wysoki (FR-012) | SQL undo, liczenie nagród w TS (widok MG) i w SQL (widok gracza) | Egzekwowany dla zwolnienia pola. „Unieważnienie” jest skutkiem liczenia, nie osobnym zapisem. Dwie implementacje liczenia mogą się rozjechać — to osobna praca, nie ten plan |
| I5 | Średni. Must-have FR-007, ale produkt dopuszcza wiele sesji. Rdzeniem jest jedna plansza na sesję, nie „dokładnie jedna sesja aktywna na koncie” | SQL close (twardy), API (połyka błąd), baner retry w UI | Naruszalny na złożeniu create+close: obie sesje zostają `active`, a klient dostaje sukces 201 |
| I6 | Średni (non-goal, granica roli) | Kolumna, RLS, middleware, każde API MG | Egzekwowany |
| I7 | Wysoki dla rozgrywki, niższy niż skład planszy | SQL join i claim | Egzekwowany |
| I8 | Średni. Opcja v2, nie wizja v1 | CHECK, zod, generator, UI zaciska licznik | Egzekwowany w CHECK i zod. UI dodatkowo poprawia wartość po cichu |
| I9 | Wysoki jako granica produktu | Brak kodu weryfikacji | Egzekwowany brakiem mechanizmu |

**Wybór: I2.** I1 jest tak samo rdzeniowy i jest już egzekwowany: jeden `UPDATE` z `claimed_by_player_id IS NULL` nie oddaje pola drugiemu graczowi (`supabase/migrations/20261003190000_player_claim_token.sql:168-174`). Kryterium tego planu to iloczyn rdzenia i luki. I2 jest jedyną regułą o tej randze, którą da się złamać legalną ścieżką zapisu: `createSession` wstawia sesję, potem komórki, potem pulę, potem linie, każde osobnym żądaniem (`src/lib/services/sessions.service.ts:132-191`). Wyjątek z drugiego albo późniejszego insertu przerywa funkcję, ale wcześniejsze wiersze zostają. API zamienia to w 500 (`src/pages/api/sessions/index.ts:97-98`) — operacja HTTP się nie udała, a sesja w bazie jest. To jest stan, w którym „wyjście to plansza N×N” jest fałszem.

I5 odpada jako numer dwa, nie jako przedmiot tego agregatu. Close sam w sobie rzuca i nie domyka wiersza (`src/pages/api/sessions/index.ts:74-85` dopisuje błąd do odpowiedzi 201). To złożenie dwóch operacji, nie narodziny planszy. Wciągnięcie go tutaj rozlałoby plan na drugi niezmiennik.

## Krok 3 — Diagnoza I2

### Gdzie reguła jest prawdziwa przed zapisem

Generator liczy komórki jako `size * size` (`src/lib/services/board-generator.ts:57`). Haseł gwarantowanych nie może być więcej niż pól (`:82-84`, błąd `TOO_MANY_GUARANTEED`). Pula musi wypełnić resztę (`:87-93`, `POOL_TOO_SMALL`). Suma nagród pól nie może przekroczyć liczby pól (`:115-116`, `TOO_MANY_REWARDS`). Wynik ma długość `size²` i pozycje `0 .. size²−1` (`:101-104`). Linie: pusta lista daje `[]` (`:134`); niepusta daje dokładnie dwa przebiegi po `size`, czyli `2 × size` wpisów (`:141-146`).

Te rzuty zatrzymują składanie w pamięci. Nie obejmują zapisu.

### Gdzie zapis regułę gubi

`createSession` (`src/lib/services/sessions.service.ts:81`):

1. Odrzuca nieznaną nagrodę przed losowaniem (`:101-116`, `UNKNOWN_REWARD`).
2. Składa komórki i linie w pamięci (`:118-127`).
3. W pętli do pięciu prób wstawia wiersz `sessions` (`:129-141`). Kolizja kodu `23505` idzie w kolejną próbę (`:143-146`). Inny błąd leci dalej (`:147`).
4. Wstawia wszystkie komórki drugim żądaniem (`:150-160`). Błąd leci dalej (`:158-159`). Sesja już jest.
5. Wstawia pulę trzecim żądaniem, jeśli lista niepusta (`:162-178`). Błąd leci dalej (`:176-177`). Sesja i komórki już są.
6. Wstawia linie czwartym żądaniem (`:181-191`). Błąd leci dalej (`:189-190`). Sesja, komórki i pula już są.
7. Po pięciu kolizjach kodu rzuca `CODE_COLLISION` (`:197`). API łapie tylko `UNKNOWN_REWARD` i zwraca 400; `CODE_COLLISION` wpada w ogólne 500 (`src/pages/api/sessions/index.ts:94-98`). To przynajmniej nie zostawia wiersza, bo kolizja dzieje się na pierwszym insercie.

Nie ma kasowania sesji po nieudanym kolejnym insercie. W `createSession` po udanym insercie sesji nie ma `.delete`.

Baza nie domyka licznika. `board_cells.position >= 0`, `UNIQUE (session_id, position)`, `UNIQUE (session_id, phrase)` (`supabase/migrations/20260927143000_sessions_and_board_cells.sql:19-23`). Nie ma `CHECK` na `position < size²` ani na `COUNT(*) = size²`. `board_lines.index >= 0` (`supabase/migrations/20261011170000_threshold_pattern_rewards.sql:24`), bez `index < size`. `PRIMARY KEY (session_id, axis, index)` (`:26`) nie wymusza kompletu wierszy i kolumn. `sessions.size` jest 3, 4 albo 5 (`20260927143000_sessions_and_board_cells.sql:8`). Próg ma CHECK (`20261011170000_threshold_pattern_rewards.sql:8-9`), ale próg jest kolumną sesji wstawianą w kroku 3, zanim istnieje pula. Sesja z `threshold_count` ustawionym i pustą pulą progu jest legalna dla CHECK, a dla polecenia MG już nie.

INSERT dla zalogowanego MG jest dozwolony wprost na `sessions`, `board_cells`, `session_reward_pool` i `board_lines` (`20260927143000_sessions_and_board_cells.sql:35-39`, `:54-65`; `20261011170000_threshold_pattern_rewards.sql:45-56`, `:71-82`). Funkcja SQL `create_session` nie istnieje. Ominięcie generatora nie wymaga obchodzenia RPC, bo RPC nie jest na tej ścieżce.

### Gdzie odczyt udaje strażnika

Strona MG porównuje `session.cells.length` z `size * size` i przy różnicy ustawia 422 (`src/pages/sessions/[id].astro:66-69`). Render pokazuje tekst z oczekiwaną i faktyczną liczbą (`:160-162`). To jedyny komunikat o braku pól i dotyczy tylko pierwszego renderu HTML.

Strona gracza robi to samo porównanie (`src/pages/play/[code].astro:81-85`) i pokazuje „Nie udało się wczytać planszy.” (`:162-164`) bez liczby. Nie montuje planszy.

Oba sprawdzenia patrzą na długość tablicy, nie na to, czy pozycje są dokładnie `0 .. size²−1`, i nie na linie. `UNIQUE (session_id, position)` puszcza `size²` wierszy z dziurą i jedną pozycją powyżej zakresu. Taka plansza przechodzi test strony.

`GET /api/sessions/[id]/board` zwraca wynik `getSessionWithCells` jako 200 (`src/pages/api/sessions/[id]/board.ts:32-37`). Brak porównania z `size²`. Poll MG co kilka sekund woła ten endpoint, więc częściowa plansza, która przeszła próg długości, jest dla wyspy zwykłą planszą.

`GET /api/play/board` zwraca planszę jako 200 (`src/pages/api/play/board.ts:31-36`, ciało `:56-57`). Też bez liczenia pól.

`getSessionWithCells` czyta linie i filtruje oś (`src/lib/services/sessions.service.ts:426-450`). Nie wymaga `2 × size` linii, gdy pula `kind = 'line'` jest niepusta.

### Gdzie klient jest jedynym albo cichym strażnikiem

Formularz liczy `maxCells`, sumę nagród i liczbę haseł gwarantowanych (`src/components/sessions/NewSessionForm.tsx:146-151`). Submit wraca wcześniej, gdy `effectiveOverLimit` (`:191-192`). Przycisk jest `disabled` na tym samym warunku (`:356`). `thresholdInvalid` jest liczone (`:156-158`) i nie blokuje submitu. Licznik progu jest wcześniej zaciskany do `1..maxCells` (`:147`), a w żądaniu próg jest `null`, gdy lista progowa jest pusta (`:208`). To poprawianie po cichu, nie odmowa.

Zod na brzegu powtarza rozmiar, limit haseł gwarantowanych, sumę nagród i spójność progu (`src/lib/schemas/session.ts:45-78`), a potem transform zeruje próg, gdy lista progowa jest pusta (`:80-83`). To drugi cichy zapis tej samej pary. CHECK w bazie jest trzeci, już po insercie sesji.

Żaden z tych trzech nie widzi porażki w środku czterech insertów.

### Połknięcie

Na ścieżce I2 błąd insertu nie jest połykany wewnątrz `createSession`: leci wyjątkiem. Połknięcie jest w skutku. Wyjątek staje się 500, wiersze zostają, a następny odczyt albo rysuje planszę (gdy komórek jest `size²`, a linii brak), albo pokazuje 422 tylko na stronie HTML (gdy komórek jest za mało). API odczytu tego nie powtarza. Gracz i MG mogą dostać sesję z kodem, która nie jest planszą z FR-004.

Osobno, na tej samej trasie, błąd zamknięcia poprzedniej sesji jest połykany naprawdę: 201 plus `closeError` (`src/pages/api/sessions/index.ts:73-89`). To I5, nie przedmiot metod agregatu poniżej. Zostaje wymienione, żeby refaktor create go nie „naprawił” przy okazji.

## Krok 4 — Agregat `Session`

### Granica

Korzeń: `Session`. W środku: pola planszy, przypisania nagród pól, linie (gdy są) i para progu. Poza agregatem: katalog haseł, katalog nagród, kod sesji, `gm_id`, gracze, zajęcia pól. I1 zostaje w `claim_board_cell`. Ten plan go nie przenosi.

`Session.compose` jest jedyną definicją I2. Funkcja SQL nie losuje haseł i nie interpretuje formularza. W jednej transakcji zapisuje wartość złożoną przez agregat i powtarza asercje kształtu z tego samego kontraktu. Powtórzenie jest konieczne: zalogowany MG ma dziś prawo `INSERT` wprost, a RPC PostgREST da się zawołać z pominięciem TypeScriptu. Bez asercji w transakcji agregat w procesie nie jest strażnikiem zapisu. Asercje SQL nie dodają reguł spoza listy poniżej. Nazwy błędów są te same.

### Kontrakt I2

Po `compose` albo po commicie prawdą jest jednocześnie:

1. `size` ∈ {3, 4, 5}.
2. Pól jest `size²`. Pozycje to dokładnie zbiór `0 .. size²−1`. Hasło pola jest niepuste. Hasła są unikalne co do zapisanego tekstu.
3. Każde hasło gwarantowane z polecenia jest wśród pól. Liczba nagród pól równa się sumie `count` i nie przekracza `size²`. Każde `rewardId` jest w katalogu.
4. Linie: lista nagród za linie pusta ⇒ zero linii. Lista niepusta ⇒ dokładnie `2 × size` linii, każdy wiersz i każda kolumna raz (`index` `0 .. size−1`), `rewardId` z tej listy.
5. Próg: lista pusta i `thresholdCount === null`, albo lista niepusta i `thresholdCount` ∈ `1 .. size²`.
6. Commit obejmuje sesję, pola, pulę i linie. Wyjątek wycofuje wszystko.

Porażka dowolnego punktu w `compose` rzuca błąd z tabeli. Nie zwraca okrojonej sesji.

| Błąd | Kiedy | HTTP |
| --- | --- | --- |
| `TooManyGuaranteedPhrases` | liczba haseł gwarantowanych > `size²` | 400 |
| `PhrasePoolTooSmall` | pula po odjęciu duplikatów nie wypełnia reszty; niesie `missing` | 400 |
| `TooManyFieldRewards` | suma `count` > `size²` | 400 |
| `UnknownReward` | identyfikator spoza katalogu (pola, linie, próg) | 400 |
| `ThresholdCountRequired` | są nagrody progowe, a `thresholdCount` jest `null` | 400 |
| `ThresholdCountOutOfRange` | próg poza `1 .. size²` | 400 |
| `IncompleteBoard` | ładunek zapisu albo odczyt nie spełnia punktów 1–5 (dziura w pozycjach, linie nie pokrywają osi, próg bez puli albo pula bez progu) | 422 przy odczycie; przy zapisie funkcja robi rollback i API zwraca 500 z kodem, bo to błąd programisty albo obcy ładunek, nie błąd MG w formularzu |
| `CodeCollision` | pięć kolizji kodu wewnątrz transakcji; żaden wiersz nie zostaje | 500 |

Kody `TOO_MANY_GUARANTEED`, `POOL_TOO_SMALL`, `TOO_MANY_REWARDS`, `UNKNOWN_REWARD`, `CODE_COLLISION` zostają jako `code` na błędzie, bo API i testy już ich używają. Nowe kody: `THRESHOLD_COUNT_REQUIRED`, `THRESHOLD_COUNT_OUT_OF_RANGE`, `INCOMPLETE_BOARD`.

### Sygnatury

```ts
type BoardSize = 3 | 4 | 5;

interface ComposeSessionCommand {
  size: BoardSize;
  customPhrases: { text: string; guaranteed: boolean }[];
  fieldRewards: { rewardId: string; count: number }[];
  lineRewardIds: string[];
  thresholdRewardIds: string[];
  thresholdCount: number | null;
}

interface ComposedCell {
  position: number;
  phrase: string;
  rewardId: string | null;
}

interface ComposedLine {
  axis: "row" | "column";
  index: number;
  rewardId: string;
}

class SessionInvariantError extends Error {
  readonly code:
    | "TOO_MANY_GUARANTEED"
    | "POOL_TOO_SMALL"
    | "TOO_MANY_REWARDS"
    | "UNKNOWN_REWARD"
    | "THRESHOLD_COUNT_REQUIRED"
    | "THRESHOLD_COUNT_OUT_OF_RANGE"
    | "INCOMPLETE_BOARD"
    | "CODE_COLLISION";
  readonly missing?: number;
}

class Session {
  private constructor(
    readonly size: BoardSize,
    readonly cells: readonly ComposedCell[],
    readonly lines: readonly ComposedLine[],
    readonly lineRewardIds: readonly string[],
    readonly thresholdRewardIds: readonly string[],
    readonly thresholdCount: number | null,
  ) {}

  static compose(
    command: ComposeSessionCommand,
    catalog: { phrases: readonly string[]; rewardIds: ReadonlySet<string> },
    random?: () => number,
  ): Session;

  static assertComplete(snapshot: {
    size: number;
    cells: { position: number; phrase: string; rewardId: string | null }[];
    lines: { axis: string; index: number; rewardId: string }[];
    lineRewardIds: readonly string[];
    thresholdRewardIds: readonly string[];
    thresholdCount: number | null;
  }): void; // rzuca IncompleteBoard
}

interface SessionRepository {
  composeAndSave(command: ComposeSessionCommand): Promise<{ id: string; code: string }>;
  loadForGm(id: string, gmId: string): Promise<LoadedSession>; // assertComplete albo IncompleteBoard
}
```

`compose` jest czysty. Kod sesji i `gm_id` powstają w repozytorium, w tej samej transakcji co insert.

### Pseudokod `compose`

```text
compose(command, catalog, random):
  maxCells = command.size * command.size
  odrzuć rewardId spoza catalog.rewardIds          → UnknownReward
  jeśli guaranteed(command) > maxCells             → TooManyGuaranteedPhrases
  jeśli suma fieldRewards.count > maxCells         → TooManyFieldRewards
  jeśli thresholdRewardIds puste i thresholdCount ≠ null
                                                   → ThresholdCountOutOfRange
  jeśli thresholdRewardIds niepuste i thresholdCount = null
                                                   → ThresholdCountRequired
  jeśli thresholdCount poza 1..maxCells (gdy lista niepusta)
                                                   → ThresholdCountOutOfRange

  cells = generateBoard(...)     // dzisiejszy algorytm; rzuca TOO_MANY_* / POOL_TOO_SMALL
  lines = drawLineRewards(...)   // [] albo dokładnie 2 * size

  assert:
    cells.length = maxCells
    pozycje = {0 .. maxCells-1}
    hasła niepuste i unikalne
    każde guaranteed jest w cells
    liczba rewardId ≠ null = suma count
    lines pokrywają każdy wiersz i kolumnę albo są puste zgodnie z listą
  niespełnienie → IncompleteBoard   // generator złamał własny kontrakt; nie zapisujemy

  return new Session(...)
```

Normalizacja haseł (trim, scalenie duplikatów, własne wypiera katalog) zostaje wewnątrz `generateBoard`, wołanego wyłącznie stąd. Zod przestaje być drugim sędzią tych nierówności: zostaje parserem kształtu JSON (typy, długość tekstu, rozmiar tablic). Transform, który zeruje `thresholdCount` (`src/lib/schemas/session.ts:80-83`), schodzi. Agregat widzi wartość z żądania i albo ją przyjmuje, albo rzuca.

Formularz może dalej zaciskać licznik i wyłączać przycisk. To wygoda, nie strażnik. Ścieżka, która pominie formularz, dostaje ten sam błąd z `compose`.

### Repozytorium i jedna transakcja

`composeAndSave`:

1. Czyta katalog haseł i identyfikatory nagród (dwa SELECT-y, poza transakcją zapisu; to odczyt referencji).
2. Woła `Session.compose`. Wyjątek domenowy kończy się przed RPC.
3. Woła jedno RPC `create_session_board` z gotowymi polami, liniami, pulą, progiem i `gm_id = auth.uid()`.

Funkcja jest `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public`, jak `claim_board_cell` (`supabase/migrations/20261003190000_player_claim_token.sql:134-136`). Jedno wywołanie RPC to jedna transakcja PostgREST. W ciele:

```text
create_session_board(p_size, p_cells, p_lines, p_line_reward_ids, p_threshold_reward_ids, p_threshold_count):
  jeśli auth.uid() IS NULL → RAISE 'not_authenticated'

  assertComplete na argumentach          → RAISE 'INCOMPLETE_BOARD' (ERRCODE P0001)
  // te same punkty 1–5; bez losowania

  FOR attempt IN 1..5:
    code = losuj 6 znaków z alfabetu bez I,O,0,1
    BEGIN
      INSERT sessions (code, size, gm_id, threshold_count)
      INSERT board_cells  — wszystkie p_cells
      INSERT session_reward_pool — line + threshold
      INSERT board_lines — wszystkie p_lines
      RETURN id, code
    EXCEPTION WHEN unique_violation na sessions.code:
      -- subtransakcja; próba nie zostawia wiersza
      kontynuuj pętlę
    END
  RAISE 'CODE_COLLISION'

  każdy inny wyjątek (FK nagrody, CHECK, unique pozycji) wychodzi z funkcji
  i wycofuje inserty tej próby
```

`RAISE` przed jakimkolwiek `INSERT`, gdy kształt jest zły, nie zostawia sesji. Wyjątek w środku próby też nie zostawia sesji, bo cała próba jest w bloku, który bez złapania `unique_violation` propaguje się do wycofania wywołania.

Po przełączeniu aplikacji na RPC osobna migracja zdejmuje polityki `INSERT` z `sessions`, `board_cells`, `session_reward_pool` i `board_lines`. Zostają `SELECT` dla właściciela. Wzorzec jest już taki przy zamknięciu i usunięciu: mutacja idzie funkcją, nie polityką UPDATE/DELETE (`supabase/migrations/20261011133000_session_close_replaced_by.sql:1-2`). Do czasu zdjęcia polityk stary insert nadal działa, więc wdrożenie funkcji i wdrożenie kodu mogą się minąć bez wyłączenia tworzenia sesji. Zdjęcie polityk jest krokiem, który zamyka obejście, i idzie dopiero gdy produkcyjny zapis woła RPC.

`loadForGm` czyta ten sam graf, który dziś czyta `getSessionWithCells`, woła `Session.assertComplete` i przy `IncompleteBoard` nie zwraca siatki. Nie kasuje osieroconych wierszy. Osierocona sesja z wcześniejszego częściowego zapisu zostaje w bazie i przestaje być grywalna (422). Sprzątanie takich wierszy nie jest częścią tego planu: to osobna, świadoma operacja na danych, nie skutek uboczny odczytu.

### Cienkie API

`POST /api/sessions` (`src/pages/api/sessions/index.ts:36`):

```text
odrzucić zły Origin i brak użytkownika          → 403 / 401 (jak dziś)
zparsować JSON
createSessionSchema — kształt, nie reguły I2
sessionRepository.composeAndSave(command)
  SessionInvariantError → status z tabeli błędów, ciało { error, code }
  inny wyjątek → 500 „Nie udało się utworzyć sesji”, reportError
201 { id, code }
```

`CODE_COLLISION` przestaje wpadać w ten sam komunikat co awaria sieci bez kodu: odpowiedź niesie `code`. Status zostaje 500, operacja stoi.

Gałąź `replaceSessionId` zostaje jak jest (I5). Ten plan jej nie spina z tworzeniem w jedną transakcję.

`GET /api/sessions/[id]/board` i pierwszy render `src/pages/sessions/[id].astro`: wołają `loadForGm`. `IncompleteBoard` → 422 i istniejący tekst o liczbie pól, rozszerzony o powód (brak linii, dziura w pozycjach), bez rysowania siatki. Strona nie liczy `cells.length === size * size` sama.

`GET /api/play/board` i `src/pages/play/[code].astro`: ten sam `assertComplete` na odczycie po kodzie. Niekompletna plansza → 422 „Nie udało się wczytać planszy.” Wyspa gracza się nie montuje. Dziś stronę gracza chroni tylko porównanie długości (`src/pages/play/[code].astro:81-85`); po zmianie chroni ją odmowa agregatu, zanim powstanie DTO.

## Krok 5 — Before / after, fazy, testy

### Before / after

| Miejsce | Dziś | Po |
| --- | --- | --- |
| `board-generator.ts:57-125` | Sam rzuca `TOO_MANY_*` / `POOL_TOO_SMALL` i zwraca tablicę. Wołany z serwisu, nie z agregatu | Zostaje algorytmem losowania. Woła go tylko `Session.compose`. Publiczne rzuty schodzą do `SessionInvariantError` |
| `board-generator.ts:128-147` | Sam decyduje: 0 albo `2 × size` linii | To samo, wyłącznie z `compose`. `assertComplete` sprawdza pokrycie osi |
| `sessions.service.ts:101-116` | `UNKNOWN_REWARD` w serwisie, przed generatorami | Warunek w `compose`. Serwis nie zna katalogu nagród jako reguły |
| `sessions.service.ts:132-191` | Cztery inserty, brak wycofania | Jedno RPC. Funkcja albo zwraca id i kod, albo nie zostawia wierszy tej próby |
| `sessions.service.ts:197` | `CODE_COLLISION` jako `SessionServiceError` | Ten sam kod na `SessionInvariantError`, rzucany z wnętrza transakcji po pięciu kolizjach |
| `src/lib/schemas/session.ts:45-83` | Drugi sędzia limitów i cichy transform progu | Parser kształtu. Nierówności I2 wychodzą z agregatu. Brak transformu zerującego próg |
| `NewSessionForm.tsx:146-151`, `:191-192`, `:208`, `:356` | Blokada przycisku i cichy zacisk progu | Zostaje jako wygoda. Nie jest cytowana jako strażnik. Żądanie z pominięciem formularza dostaje błąd agregatu |
| `src/pages/api/sessions/index.ts:63-98` | `createSession`, potem osobny close; `UNKNOWN_REWARD` i błędy generatora mapowane ręcznie; reszta 500 | `composeAndSave`, mapa `SessionInvariantError` → status. Close bez zmian |
| `src/pages/sessions/[id].astro:66-69` | Jedyny twardy odczyt MG: długość tablicy | `loadForGm` rzuca `IncompleteBoard`. Strona tylko rysuje 422 |
| `src/pages/play/[code].astro:81-85` | To samo po stronie gracza, słabszy tekst | To samo źródło odmowy co u MG |
| `src/pages/api/sessions/[id]/board.ts:32-37` i `src/pages/api/play/board.ts:31-57` | 200 dla dowolnej liczby komórek | 422 przy `IncompleteBoard`, 200 tylko dla planszy, która przeszła `assertComplete` |
| SQL `board_cells` / `board_lines` | UNIQUE i CHECK zakresu dolnego; INSERT dla `authenticated` | UNIQUE zostają. Dochodzi RPC z asercją kształtu. Po przełączeniu zapisu polityki INSERT schodzą |
| `tests/integration/create-session-board.test.ts:81-111` | 201 i niezmienniki na ścieżce sukcesu | Zostaje. Nie dowodzi wycofania przy porażce w środku zapisu — to nowe testy poniżej |

### Fazy

Fazy 1–2 są test-first na Vitest unit (`npm run test:unit`), bo `Session.compose` i `assertComplete` są czyste, jak dzisiejszy generator. Faza 3 jest test-first na integracji (`npm run test:integration`): najpierw czerwony test RPC, potem funkcja. Faza 4 przepina zapis i jest czerwona na nowym teście wycofania, zanim znikną cztery inserty. Faza 5 przepina odczyt. Faza 6 zdejmuje polityki INSERT.

1. **Agregat w pamięci.** Testy `Session.compose` z listy poniżej, czerwone. Potem `src/lib/domain/session.ts`. Generator bez zmiany algorytmu, tylko nowe miejsce wywołania jeszcze niepodpięte pod HTTP.
2. **`assertComplete`.** Testy odczytu niekompletnego snapshotu, czerwone, potem metoda. Nadal bez zmiany tras.
3. **RPC `create_session_board`.** Migracja dodaje funkcję i nie rusza polityk INSERT. Test integracyjny: ładunek z `size² − 1` polami kończy się `INCOMPLETE_BOARD` i `SELECT` sesji po kodzie nic nie zwraca. Drugi test: nieznany `reward_id` (FK) nie zostawia sesji. Trzeci: legalny ładunek 3×3 zostawia 9 pól i zero linii.
4. **Zapis aplikacji.** `createSession` staje się `composeAndSave`. Test integracyjny istniejącej ścieżki 201 (`create-session-board.test.ts:81`) ma dalej przechodzić. Nowy test: odpowiedź 400 z `code: "TOO_MANY_GUARANTEED"` nie tworzy wiersza `sessions` dla tego MG w oknie czasu testu. `CODE_COLLISION` mapowany z kodem, nie jako goły tekst 500 bez `code`.
5. **Odczyt.** `loadForGm` i odczyt gracza. Test: sesja wstawiona SQL-em z `size = 3` i 8 komórkami daje 422 na `GET /api/sessions/:id/board` i na `GET /api/play/board`, bez siatki w ciele. Strony przestają liczyć długość same.
6. **Zamknięcie obejścia.** Migracja `DROP POLICY` INSERT na czterech tabelach. Test: bezpośredni insert komórki rolą zalogowanego MG jest odmówiony; `POST /api/sessions` nadal daje 201.

Faza 6 nie wchodzi w tym samym kroku co faza 3. Między nimi stary klient nadal potrafi wstawić sesję tabelami. To świadome okno, opisane wyżej.

Poza planem: spięcie create i close w jedną transakcję (I5), scalenie dwóch liczeń nagród linii (I4), przeniesienie I1 z `claim_board_cell` do tego agregatu.

### Testy I2

Legalne, unit, faza 1–2:

- Rozmiar 5, dość haseł katalogu, zero nagród → 25 pól, pozycje `0..24`, hasła unikalne, zero linii, `thresholdCount = null`.
- Rozmiar 3, trzy hasła gwarantowane, reszta z katalogu, stały RNG → wszystkie trzy teksty są na planszy (ryzyko nr 9 z `context/foundation/test-plan.md:50`).
- Lista linii niepusta, rozmiar 4 → 8 linii, każda para (`row`|`column`, `0..3`) raz.
- Lista linii pusta → `lines` puste, także gdy `thresholdCount` jest ustawiony i lista progowa niepusta.
- Próg `1` przy `size = 3` i jednej nagrodzie progowej → przechodzi.
- Snapshot z 9 polami na pozycjach `0..8`, `size = 3`, bez linii i bez progu → `assertComplete` nie rzuca.

Nielegalne, unit:

- Haseł gwarantowanych więcej niż `size²` → `TOO_MANY_GUARANTEED`, brak obiektu `Session`.
- Pula krótsza niż brakujące pola → `POOL_TOO_SMALL` i `missing` równe luce.
- Suma `count` nagród pól większa niż `size²` → `TOO_MANY_REWARDS`.
- `rewardId` spoza zbioru → `UNKNOWN_REWARD` (pole, linia i próg — trzy przypadki).
- Nagrody progowe i `thresholdCount = null` → `THRESHOLD_COUNT_REQUIRED`.
- Nagrody progowe i próg `0` albo `size² + 1` → `THRESHOLD_COUNT_OUT_OF_RANGE`.
- Pusta lista progowa i `thresholdCount = 3` → `THRESHOLD_COUNT_OUT_OF_RANGE` (koniec cichego zerowania).
- Snapshot: 8 pól przy `size = 3` → `INCOMPLETE_BOARD`.
- Snapshot: 9 pól, pozycje `0..7` i `99` → `INCOMPLETE_BOARD`.
- Snapshot: pula linii niepusta, linii `2 × size − 1` → `INCOMPLETE_BOARD`.
- Snapshot: linie są, pula linii pusta → `INCOMPLETE_BOARD`.
- Snapshot: `thresholdCount` ustawiony, pula progu pusta → `INCOMPLETE_BOARD`.
- Snapshot: pula progu niepusta, `thresholdCount = null` → `INCOMPLETE_BOARD`.

Integracja, fazy 3–5:

- RPC z niekompletnym ładunkiem: wyjątek `INCOMPLETE_BOARD`, zero nowych wierszy `sessions`.
- RPC z obcym `reward_id`: wyjątek FK, zero nowych wierszy `sessions`.
- `POST /api/sessions` ze zbyt wieloma hasłami gwarantowanymi: 400, `code` `TOO_MANY_GUARANTEED`, brak sesji.
- `POST` legalny 5×5: 201, `GET` planszy MG 200, 25 pól, hasła gwarantowane obecne (istniejący test zostaje).
- Sesja dopisana migracją testową bez kompletu pól: oba GET-y planszy zwracają 422 i nie zawierają listy pól do gry.

### Nazwy load-bearing

Projekt nie prowadzi rejestru kontraktów. `context/domain/glossary.md` nie istnieje. `context/foundation/README.md` wymienia słownik jako dokument, który projekt może mieć, nie jako istniejący rejestr. Poniższe nazwy mają trafić do słownika przy najbliższej destylacji, a do tego czasu są kontraktem tego planu. Nie wolno wprowadzić drugiej nazwy na ten sam byt.

| Nazwa | Znaczy | Nie nazywać |
| --- | --- | --- |
| `Session` | Agregat: jedna sesja = jedna plansza = jeden kod | `Board`, `Bingo`, `Game` jako korzeń |
| `Session.compose` | Jedyna operacja, która rodzi legalną planszę | `createSession` jako miejsce reguł I2 |
| `Session.assertComplete` | Odmowa odczytu planszy, która nie jest całością | porównanie `cells.length === size * size` w stronie |
| `SessionInvariantError` | Nazwany błąd, który zatrzymuje operację | `SessionServiceError` dla reguł I2 (zostaje tylko jeśli opakowuje obce błędy techniczne) |
| `IncompleteBoard` / `INCOMPLETE_BOARD` | Plansza nie spełnia kontraktu I2 | HTTP 200 z krótszą siatką, ciche dopełnianie pól |
| `create_session_board` | Jedyna transakcja zapisu nowej sesji | cztery `.insert` w serwisie |
| `ComposedCell` | Pole po złożeniu, jeszcze bez id wiersza | `BoardCell` (to wiersz tabeli, `src/types.ts:6`) |

Istniejące kody `TOO_MANY_GUARANTEED`, `POOL_TOO_SMALL`, `TOO_MANY_REWARDS`, `UNKNOWN_REWARD`, `CODE_COLLISION` zostają. Nowe kody dokładane do tej listy, nie jako synonimy tamtych.

## Podsumowanie

Wizja produktu stoi na wspólnej planszy N×N, z której nagroda wynika z reguły. Reguła „pole zajęte raz” jest już egzekwowana jednym `UPDATE` w `claim_board_cell` i dlatego nie jest przedmiotem tego planu. Wyjście opisane w Business Logic — kompletna plansza albo nic — jest egzekwowane tylko w pamięci generatora. `createSession` zapisuje sesję, komórki, pulę i linie czterema osobnymi insertami, więc porażka w środku zostawia sesję, która nie jest planszą. Strony HTML liczą co najwyżej długość tablicy komórek, a GET-y planszy zwracają 200 bez tego liczenia. Agregat `Session` z metodą `compose` ma być jedyną definicją kontraktu: nielegalne polecenie rzuca `SessionInvariantError` i nie tworzy obiektu. Repozytorium zapisuje wynik jedną funkcją `create_session_board`, która powtarza asercje kształtu i albo commituje całość, albo wycofuje próbę. Odczyt woła `assertComplete` i odpowiada 422 zamiast rysować ułamek. Formularz zostaje wygodą. Zamknięcie poprzedniej sesji przy podmianie planszy zostaje poza tym refaktorem.
