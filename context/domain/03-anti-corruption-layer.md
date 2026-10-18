---
title: Warstwa antykorupcyjna dla klienta Supabase
created: 2026-10-18
type: refactor-plan
---

# Warstwa antykorupcyjna dla klienta Supabase

Plan refaktoru. Kod produkcyjny zostaje bez zmian do czasu osobnej implementacji.

Zależność wybrana po inwentaryzacji: pakiety `@supabase/ssr` i `@supabase/supabase-js` (auth GoTrue + PostgREST). Przeciekają jako typ `User`, klient wołany z API i stron SSR oraz wygenerowany wiersz tabeli używany jako model sesji.

## 0. Kontekst

Produkt to RPG Bingo: wspólna plansza bingo na sesję papierowego RPG (`context/foundation/prd.md:22`, `context/foundation/prd-v2.md:22`). Mistrz Gry ma konto. Gracz nie ma konta — tożsamość gracza żyje w ciasteczku sesji gry (`context/foundation/prd.md:131-133`).

Stack z `package.json` i `context/foundation/tech-stack.md:24`: Astro 7 SSR, React 19 (wyspy), TypeScript, Tailwind 4, Supabase (auth + Postgres), Cloudflare Workers. Zod waliduje ciała HTTP. Sentry zbiera nieoczekiwane błędy. `qrcode.react` rysuje kod dołączenia.

Warstwy kodu dziś:

| Warstwa | Gdzie | Co robi |
| --- | --- | --- |
| Wejście HTTP | `src/pages/api/**`, `src/middleware.ts` | Auth, sesje, join, claim |
| Strony SSR | `src/pages/**/*.astro` | Składają dane i HTML |
| Wyspy | `src/components/**` | Polling, formularze |
| Usługi | `src/lib/services/**` | Losowanie planszy, odczyt i zapis sesji |
| Kontrakt współdzielony | `src/types.ts` | Typy „domenowe” i odpowiedzi JSON |
| Schemat wygenerowany | `src/db/database.types.ts` | Kształt PostgREST |
| Baza | `supabase/migrations/**` | Tabele, RLS, funkcje SQL |

Deklaracje o wymienialności. Dokumenty **nie** mówią, że Supabase ma być wtyczką. Ustalają go jako dostawcę:

- `context/foundation/tech-stack.md:24` — „Supabase covers the Game Master login (FR-001) and gives Postgres constraints…”
- `context/foundation/infrastructure.md:129` — „Hosting Supabase (pozostaje na Supabase Cloud jako zewnętrzny dostawca zgodnie z odpowiedzią Q5)”
- `context/foundation/infrastructure.md:17` — wymienialny jest adapter hostingu Astro (`@astrojs/vercel` / `@astrojs/netlify` / `@astrojs/node`), nie klient bazy.

Jedyna próba szwu wobec tego SDK to fabryka klienta. `CLAUDE.md:29` opisuje `src/lib/supabase.ts` jako miejsce tworzenia klienta SSR. Fabryka istnieje (`src/lib/supabase.ts:6-21`), a jej wartość zwracana — klient SDK — wychodzi do middleware, API, stron i sygnatur usług.

Historyczna deklaracja „bez vendora” dotyczy Sentry, nie Supabase. Plan `report-error-helper` wykluczał tracker (`context/archive/2026-10-07-report-error-helper/plan.md:31`). Późniejszy plan świadomie włożył Sentry do `reportError` (`context/archive/2026-10-07-configure-sentry/plan.md:24`). Ta granica jest dziś wąska i zgodna z późniejszą decyzją. Nie wygrywa rankingu.

## 1. Kandydaci

Sygnał „ten sam pakiet w wielu warstwach” sprawdzony grepem importów w `src/` i `tests/`.

| Zależność | Gdzie jest import | Warstwy | Koszt wymiany dziś | Deklarowana wymienialność |
| --- | --- | --- | --- | --- |
| `@supabase/ssr`, `@supabase/supabase-js` | 6 plików kodu/testów + typ `User` w `App.Locals`; kształt wiersza w `src/types.ts` i w JSON dla wysp | middleware, API, SSR, usługa, kontrakt współdzielony, wyspy (pola wiersza), testy | Wysoki: każda operacja sesji bierze `SupabaseClient`; UI czyta kolumny PostgREST | Nie. Dostawca jest wybrany na stałe. Szew fabryki i tak przecieka |
| `@sentry/cloudflare`, `@sentry/astro` | `src/lib/report-error.ts:1`, `sentry.server.config.ts:1`, `sentry.client.config.ts:1`, `astro.config.mjs:7`, mock w `src/lib/report-error.test.ts:14` | reporter + konfiguracja procesu | Niski dla wywołań: reszta kodu woła `reportError` | Wcześniejszy plan mówił „bez vendora”; późniejszy plan celowo wiąże helper z Sentry |
| `zod` | `src/lib/schemas/session.ts:1`, `play-join.ts:1`, `play-claim.ts:1`, `session-close.ts:1`, `session-undo-claim.ts:1` | tylko schematy wejścia HTTP | Niski | Nie |
| `qrcode.react` | `src/components/sessions/SessionJoinQr.tsx:3` | jedna wyspa | Niski | Nie |
| `radix-ui`, `lucide-react`, `class-variance-authority` | prymitywy w `src/components/ui/**` i ikony | prezentacja | Niski | Nie |

### Pliki, które dziś znają `@supabase/ssr` albo `@supabase/supabase-js`

Import pakietu (to łapie grep nazwy pakietu):

| Plik:linia | Co wie |
| --- | --- |
| `src/lib/supabase.ts:1` | `createServerClient`, `parseCookieHeader` z `@supabase/ssr` |
| `src/lib/services/sessions.service.ts:1` | `SupabaseClient` |
| `src/env.d.ts:3` | `App.Locals.user` to `import("@supabase/supabase-js").User` |
| `src/lib/services/delete-session.test.ts:2` | `SupabaseClient` |
| `src/lib/services/close-session-as-replaced.test.ts:2` | `SupabaseClient` |
| `tests/integration/threshold-pattern-rewards.test.ts:3` | `createClient`, `SupabaseClient`; wołanie `signInWithPassword` w `:50-51` |

Wzmianki dokumentacyjne (nie wołają SDK): `CLAUDE.md:29`, `context/foundation/infrastructure.md:64-65`, `context/domain/evidence/0-sources.md:12`.

Pośrednia znajomość tego samego SDK (brak importu pakietu, jest klient, wygenerowany schemat albo kolumny wiersza):

| Plik:linia | Co wie |
| --- | --- |
| `src/lib/supabase.ts:4` | `Database` z wygenerowanego schematu; `:10` `createServerClient<Database>` |
| `src/lib/services/sessions.service.ts:2` | `Database`, `Json`; `:26` alias klienta; `:28-30` `rpcRows` pod null z klienta |
| `src/db/database.types.ts:12-13` | `__InternalSupabase.PostgrestVersion` |
| `src/db/database.types.ts:250-259` | wiersz `sessions` (`gm_id`, `created_at`, `threshold_count`, `status: string`) |
| `src/types.ts:1-7` | `Phrase`, `Reward`, `Session`, `BoardCell`, `SessionPlayer` = wiersze `Database` |
| `src/types.ts:100` i `:114` | roster bierze `created_at` z wiersza `session_players` |
| `src/middleware.ts:3`, `:8`, `:14`, `:18` | tworzy klienta, `auth.getUser()`, zapisuje `User` do `locals` |
| `src/pages/api/auth/signin.ts:3`, `:32`, `:45`, `:55` | klient, `signInWithPassword`, `error.message` w odpowiedzi |
| `src/pages/api/auth/signup.ts:3`, `:16`, `:24`, `:33` | to samo dla `signUp` |
| `src/pages/api/auth/signout.ts:3`, `:6`, `:8` | `auth.signOut()` |
| `src/pages/api/sessions/index.ts:13`, `:58` | klient tworzony w endpoincie |
| `src/pages/api/sessions/[id].ts:5`, `:33` | j.w. |
| `src/pages/api/sessions/[id]/board.ts:4`, `:27`, `:33` | klient + `locals.user.id` |
| `src/pages/api/sessions/[id]/close.ts:6`, `:47` | j.w. |
| `src/pages/api/sessions/[id]/undo-claim.ts:6`, `:47` | j.w. |
| `src/pages/api/play/join.ts:7`, `:60` | j.w. |
| `src/pages/api/play/claim.ts:7`, `:44` | j.w. |
| `src/pages/api/play/board.ts:6`, `:24` | j.w. |
| `src/pages/dashboard/index.astro:5`, `:9`, `:14`, `:22` | klient, `locals.user`, lista sesji |
| `src/pages/sessions/new/index.astro:8`, `:17-20`, `:35-37` | klient i dwa zapytania `.from(...)` w stronie |
| `src/pages/sessions/[id].astro:27`, `:32`, `:38`, `:49`, `:60` | klient, `user.id`, `created_at`, `replaced_by_session_id` |
| `src/pages/play/[code].astro:9`, `:39`, `:70` | klient tworzony dwa razy na jednym żądaniu |
| `src/pages/index.astro:5`, `src/pages/play/index.astro:12`, `src/pages/auth/signin/index.astro:5`, `src/pages/auth/signup/index.astro:5`, `src/pages/auth/confirm-email/index.astro:4` | gałąź na `locals.user` (obiekt `User`) |
| `src/components/dashboard/DashboardSessionList.tsx:16`, `:128` | props `Session` (wiersz), render `created_at` |
| `src/components/sessions/GmBoard.tsx:171` | poll JSON czyta `threshold_count` |
| `src/components/play/PlayerBoard.tsx:127` | parser odpowiedzi wymaga `created_at` |
| `src/components/sessions/NewSessionForm.tsx:12` | `Reward` = wiersz katalogu |
| `src/lib/report-error.ts:30-37` | rozpoznaje `__isAuthError`, `PostgrestError`, kształt `details`+`hint` |
| `src/lib/services/delete-session.test.ts:3`, `src/lib/services/close-session-as-replaced.test.ts:3`, `tests/integration/threshold-pattern-rewards.test.ts:5` | `Database` |

Zod, Sentry i `qrcode.react` zostają poza tym refaktorem. Zod siedzi na granicy wejścia. Sentry siedzi w helperze i w plikach konfiguracyjnych. QR jest jednym komponentem.

## 2. Wybór

Najgorszy przeciek: **`@supabase/ssr` + `@supabase/supabase-js`**.

- **Zasięg.** Sześć plików importuje pakiet, a kształt klienta i wiersza znają middleware, jedenaście endpointów i stron SSR, usługa sesji, `src/types.ts`, trzy wyspy i testy. Żaden inny pakiet nie przechodzi tylu warstw.
- **Koszt wymiany.** Podmiana klienta wymaga dziś zmiany sygnatur (`sessions.service.ts:26`, `:82`, `:200`), każdego `createClient(...)`, typu `App.Locals` (`env.d.ts:3`) i każdego pola `created_at` / `gm_id` / `threshold_count` w UI. Samo przeniesienie importu nie wystarczy: `Session` **jest** wierszem (`types.ts:5`).
- **Intencja a kod.** Dokumenty nie obiecują wymiany Supabase. Obiecują jeden moduł tworzący klienta (`CLAUDE.md:29`, `src/lib/supabase.ts:6`). Kod tej obietnicy nie dotrzymuje: funkcja zwraca obiekt SDK, a strony same wołają `.from` (`sessions/new/index.astro:17-20`).

Sentry przegrywa, bo wołania są już za `reportError`. Rozjazd „bez vendora” został świadomie zamknięty planem konfiguracji Sentry. Zod i QR nie przekraczają swojej warstwy.

Pakiet `@supabase/ssr` **nie** wchodzi do bundla wysp React. Żaden plik `*.tsx` go nie importuje. Groźba jest inna: kontrakt JSON i propsy wysp niosą kolumny PostgREST (`GmBoard.tsx:171`, `PlayerBoard.tsx:127`, `DashboardSessionList.tsx:128`), a komunikat GoTrue trafia do HTML (`signin.ts:55` → `auth/signin/index.astro:9` → `SignInForm`).

## 3. Diagnoza

### Model sesji jest wierszem

```1:7:src/types.ts
import type { Database } from "@/db/database.types";

export type Phrase = Database["public"]["Tables"]["phrases"]["Row"];
export type Reward = Database["public"]["Tables"]["rewards"]["Row"];
export type Session = Database["public"]["Tables"]["sessions"]["Row"];
export type BoardCell = Database["public"]["Tables"]["board_cells"]["Row"];
export type SessionPlayer = Database["public"]["Tables"]["session_players"]["Row"];
```

Wygenerowany wiersz ma kolumny persystencji i poszerzone typy (`status` i `size` to `string` / `number`, nie unie domenowe):

```250:259:src/db/database.types.ts
      sessions: {
        Row: {
          code: string
          created_at: string
          gm_id: string
          id: string
          replaced_by_session_id: string | null
          size: number
          status: string
          threshold_count: number | null
```

Odczyt planszy MG składa obiekt odpowiedzi z tych kolumn i **dokłada** obok camelCase. To samo pole żyje dwa razy:

```515:528:src/lib/services/sessions.service.ts
  return {
    id: data.id,
    gm_id: data.gm_id,
    code: data.code,
    size: data.size,
    status: data.status,
    replaced_by_session_id: data.replaced_by_session_id,
    created_at: data.created_at,
    threshold_count: data.threshold_count,
    cells,
    players,
    rewardRules: {
      thresholdCount: data.threshold_count,
```

Komórki idą do JSON przez spread wiersza (`sessions.service.ts:508-513`): `session_id`, `reward_id`, `claimed_by_player_id`, `claimed_at` razem z dokładanym `claimedByColor`. Ścieżka gracza już mapuje wiersz na wąski obiekt (`sessions.service.ts:60-76`). Dwa kształty tej samej komórki.

### UI czyta persystencję

Panel MG dostaje `Session[]` (`dashboard/index.astro:6`, `:22`) i rysuje kolumnę:

```128:128:src/components/dashboard/DashboardSessionList.tsx
                    <span>{formatDate(session.created_at)}</span>
```

Strona planszy formatuje `session.created_at` (`sessions/[id].astro:60`) i czyta `session.replaced_by_session_id` (`:49`). Polling wyspy bierze `data.threshold_count` (`GmBoard.tsx:171`), choć obok jest już `rewardRules.thresholdCount`. Parser planszy gracza wymaga snake_case (`PlayerBoard.tsx:121-127`).

### Klient SDK jest parametrem domeny

```26:30:src/lib/services/sessions.service.ts
type AppSupabaseClient = SupabaseClient<Database>;

/** Supabase generated types omit null; runtime can still return null on success. */
function rpcRows<T>(data: T[] | null): T[] {
  return data ?? [];
```

Każda operacja (`createSession` `:82`, `listSessionsForGm` `:200`, `getSessionWithCells` `:404`, `joinSessionPlayer` `:623`, `claimBoardCell` `:666`, `closeSessionAsReplaced` `:751`, `deleteSession` `:787`, `undoBoardCell` `:804`) przyjmuje ten klient. Strona nowej sesji omija usługę i sama woła PostgREST (`sessions/new/index.astro:17-20` i `:35-37`).

Kolizja kodu sesji jest SQLSTATE w usłudze:

```143:146:src/lib/services/sessions.service.ts
    if (sessionError) {
      if (sessionError.code === "23505") {
        continue;
      }
```

Cztery funkcje czytają `error.message` sterownika i szukają tekstu `RAISE`: `joinErrorFromMessage` (`sessions.service.ts:615-618`), `undoErrorFromMessage` (`:723-727`), `closeSessionAsReplacedErrorFromMessage` (`:743-746`), `deleteSessionErrorFromMessage` (`:781-783`). Test utrwala prefiks sterownika `"ERROR: "` (`delete-session.test.ts:13-14`).

### Tożsamość MG jest `User`

```1:4:src/env.d.ts
declare namespace App {
  interface Locals {
    user: import("@supabase/supabase-js").User | null;
  }
}
```

Middleware woła `supabase.auth.getUser()` i wkłada cały obiekt do `locals` (`middleware.ts:14-18`). Endpointy biorą `user.id`. Ekran logowania oddaje użytkownikowi `error.message` z Auth (`signin.ts:45-55`, `signup.ts:24-33`). Filtr „czy to błąd infrastruktury” jest skopiowany: `signin.ts:21-24` i `signup.ts:5-8` (gałąź po `error.status`).

`report-error.ts:30-37` rozpoznaje błąd Auth po `__isAuthError` i błąd PostgREST po nazwie `PostgrestError`. Wiedza o kształcie SDK siedzi w reporterze, obok Sentry.

### Czego dokumenty nie obiecują

Wymiana biblioteki nie jest wymaganiem produktu. Plan i tak izoluje ją, bo dzisiejszy koszt jest w warstwach produktu (API, SSR, wyspy), a tabele SQL mają zostać. Migracje zostają źródłem prawdy dla Postgresa. Ten plan izoluje **pakiety JS i wygenerowany typ klienta**, nie dialekt SQL.

## 4. Projekt ACL

Katalog `src/acl/supabase/` jest jedynym miejscem, które importuje `@supabase/ssr`, `@supabase/supabase-js` i `database.types.ts`.

Domena (`src/domain/`) nie importuje tych pakietów. Tłumaczenie kształtu SDK i kolumn jest w jednym module ACL, `session-row.ts`. Tam jest value object persystencji. Encja, którą widzi reszta aplikacji, jest czysta.

Dwa wąskie porty, jeden katalog adaptera. Jeden interfejs z `.from`, `.rpc` i `.auth` odtworzyłby szeroki klient. Auth MG i magazyn sesji to dwa porty, bo gracz z PRD nie jest użytkownikiem Auth (`prd.md:133`).

### Encja domenowa `Session` i VO `GameMaster`

```ts
// src/domain/game-master.ts
export interface GameMaster {
  readonly id: string;
}

// src/domain/session.ts
export type BoardSize = 3 | 4 | 5;
export type SessionStatus = "active" | "closed";

export interface Session {
  readonly id: string;
  readonly gameMasterId: string;
  readonly code: string;
  readonly size: BoardSize;
  readonly status: SessionStatus;
  readonly openedAt: string; // ISO-8601, dawne created_at
  readonly thresholdCount: number | null;
  readonly replacedBySessionId: string | null;
}

export function sessionWasReplaced(session: Session): boolean {
  return session.replacedBySessionId !== null;
}

export function isBoardSize(value: number): value is BoardSize {
  return value === 3 || value === 4 || value === 5;
}
```

Widok planszy dla UI (`SessionBoard`, `PlayerBoard`) używa wyłącznie camelCase (`openedAt`, `thresholdCount`, `claimedByColor`). Nie zawiera `gm_id`, `created_at`, `threshold_count`, `session_id` ani `claimed_by_player_id`.

### Jedyno miejsce wiedzy o kształcie SDK

```ts
// src/acl/supabase/session-row.ts
// import type { User } from "@supabase/supabase-js"
// import type { Database } from "./database.types"

type SessionsRow = Database["public"]["Tables"]["sessions"]["Row"];
type SessionsInsert = Database["public"]["Tables"]["sessions"]["Insert"];

export function gameMasterFromUser(user: User): GameMaster {
  return { id: user.id };
}

export function sessionFromRow(row: SessionsRow): Session {
  if (!isBoardSize(row.size)) throw new Error("session.size out of domain");
  if (row.status !== "active" && row.status !== "closed") {
    throw new Error("session.status out of domain");
  }
  return {
    id: row.id,
    gameMasterId: row.gm_id,
    code: row.code,
    size: row.size,
    status: row.status,
    openedAt: row.created_at,
    thresholdCount: row.threshold_count,
    replacedBySessionId: row.replaced_by_session_id,
  };
}

export function sessionInsert(gm: GameMaster, code: string, size: BoardSize, thresholdCount: number | null): SessionsInsert {
  return { code, size, gm_id: gm.id, threshold_count: thresholdCount };
}
```

To jedyny plik, który czyta `User`, `gm_id`, `created_at`, `threshold_count`, `replaced_by_session_id` na sesji. Analogiczne funkcje dla katalogu nagród, komórki i gracza siedzą w tym samym pliku (albo w `board-row.ts` obok), nadal w `src/acl/supabase/`.

### Porty

```ts
// src/domain/game-master-authenticator.ts
export type AuthFailure =
  | { kind: "invalid_credentials" }
  | { kind: "email_not_confirmed" }
  | { kind: "email_exists" }
  | { kind: "unavailable" };

export type AuthResult = { ok: true } | { ok: false; failure: AuthFailure };

export interface GameMasterAuthenticator {
  current(): Promise<GameMaster | null>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signUp(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<AuthResult>;
}

// src/domain/session-store.ts
export type StoreFailure =
  | { kind: "session_code_taken" }
  | { kind: "session_not_found" }
  | { kind: "session_not_active" }
  | { kind: "session_full" }
  | { kind: "invalid_nick" }
  | { kind: "invalid_position" }
  | { kind: "cell_not_found" }
  | { kind: "player_not_found" }
  | { kind: "replacement_not_found" };

export interface SessionStore {
  listFor(gm: GameMaster): Promise<Session[]>;
  rewardCatalog(): Promise<RewardCatalogItem[]>;
  findBoard(sessionId: string, gm: GameMaster): Promise<SessionBoard | null>;
  insertNew(gm: GameMaster, draft: NewSessionDraft): Promise<{ ok: true; id: string; code: string } | { ok: false; failure: StoreFailure }>;
  playerBoard(code: string): Promise<PlayerBoard | null>;
  joinPlayer(input: { code: string; nick: string; claimToken: string | null }): Promise<JoinedPlayer | { failure: StoreFailure }>;
  claimCell(input: { code: string; claimToken: string; position: number }): Promise<ClaimResult | { failure: StoreFailure }>;
  undoCell(input: { sessionId: string; position: number }): Promise<UndoResult | { failure: StoreFailure }>;
  closeAsReplaced(input: { sessionId: string; replacedBySessionId: string }): Promise<{ ok: true } | { failure: StoreFailure }>;
  delete(sessionId: string): Promise<{ ok: true } | { failure: StoreFailure }>;
  rewardSnapshot(code: string, claimToken: string): Promise<RewardSnapshot>;
  codeFor(sessionId: string, gm: GameMaster): Promise<string | null>;
}
```

Pętla pięciu prób kodu sesji zostaje w usłudze aplikacji (`createSession`). Port zwraca `session_code_taken`. Usługa losuje następny kod. SQLSTATE `23505` nie wychodzi z adaptera.

`src/lib/services/sessions.service.ts` po refaktorze przyjmuje `SessionStore`, nie `SupabaseClient`. Losowanie planszy (`board-generator`) zostaje czystą funkcją.

### Adapter

```ts
// src/acl/supabase/client.ts
// jedyny import @supabase/ssr
export function createSupabaseClient(requestHeaders: Headers, cookies: AstroCookies): SupabaseClient<Database> | null

// src/acl/supabase/postgrest-error.ts
// jedyny opis PostgrestError / AuthApiError
export function failureFromPostgrest(error: { code?: string; message: string }): StoreFailure | null
export function failureFromAuth(error: { code?: string; status?: number }): AuthFailure

// src/acl/supabase/supabase-session-store.ts
export function supabaseSessionStore(client: SupabaseClient<Database>): SessionStore

// src/acl/supabase/supabase-game-master-auth.ts
export function supabaseGameMasterAuth(client: SupabaseClient<Database> | null): GameMasterAuthenticator
```

Szkic `insertNew` (fragment kolizji kodu — reszta insertów komórek, puli i linii zostaje w tej metodzie, bo to jeden zapis agregatu):

```ts
const { error } = await client.from("sessions").insert(sessionInsert(gm, draft.code, draft.size, draft.thresholdCount)).select("id, code").single();
if (error) {
  const failure = failureFromPostgrest(error);
  if (failure?.kind === "session_code_taken") return { ok: false, failure };
  throw error; // nieznany błąd sterownika — łapie reportError w API
}
```

Szkic auth:

```ts
async signIn(email, password) {
  if (!client) return { ok: false, failure: { kind: "unavailable" } };
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (!error) return { ok: true };
  return { ok: false, failure: failureFromAuth(error) };
}

async current() {
  if (!client) return null;
  const { data, error } = await client.auth.getUser();
  if (error) {
    // unavailable → reportError tutaj albo wynik boczny; locals i tak null
    return null;
  }
  return data.user ? gameMasterFromUser(data.user) : null;
}
```

Middleware woła `authenticator.current()` i ustawia `locals.gameMaster: GameMaster | null`. Pole `locals.user` znika.

API logowania:

```ts
const result = await auth.signIn(email, password);
if (!result.ok) {
  if (result.failure.kind === "unavailable") reportError(...);
  return redirect(`/auth/signin?error=${authFailureCode(result.failure)}`);
}
```

`authFailureCode` zwraca stabilny kod (`credentials`, `confirm`, `exists`, `unavailable`). Polski tekst zostaje w stronie / formularzu, tak jak reszta copy produktu. `error.message` z GoTrue nie wchodzi do query stringa.

### Składanie na żądanie

Jedna funkcja `src/acl/supabase/request-scope.ts`:

```ts
export function scopeFrom(requestHeaders: Headers, cookies: AstroCookies): {
  auth: GameMasterAuthenticator;
  sessions: SessionStore | null; // null gdy brak SUPABASE_URL/KEY
}
```

Strony i endpointy biorą `sessions` i `auth`. Nie widzą `createServerClient`.

## 5. Dowód izolacji i before/after

### Wymiana pakietu

Podmiana `@supabase/supabase-js` i `@supabase/ssr` na inny klient Postgresa i inny mechanizm sesji konta dotyka wyłącznie:

- `src/acl/supabase/client.ts`
- `src/acl/supabase/database.types.ts` (albo jego zamiennik w tym katalogu)
- `src/acl/supabase/session-row.ts`
- `src/acl/supabase/postgrest-error.ts`
- `src/acl/supabase/supabase-session-store.ts`
- `src/acl/supabase/supabase-game-master-auth.ts`
- `src/acl/supabase/request-scope.ts`
- testów leżących w `src/acl/supabase/`

Zostają bez zmian:

- `supabase/migrations/**` — kolumny, RLS, funkcje SQL (to schemat Postgresa, nie pakiet npm)
- `src/pages/api/**` — wołają port i mapują `StoreFailure` / `AuthFailure` na HTTP
- `src/pages/**/*.astro` — dostają `Session` / `SessionBoard`
- `src/components/**` — dostają pola domenowe
- `src/domain/**` i `src/lib/services/board-generator.ts`, `reward-progress.ts`, `line-slots.ts`

### Before / after

**Lista sesji MG**

- Before: `listSessionsForGm` zwraca `Session`, czyli wiersz (`sessions.service.ts:200-208`). Wyspa czyta `session.created_at` (`DashboardSessionList.tsx:128`).
- After: `SessionStore.listFor` zwraca `Session` z `openedAt`. Wyspa dostaje `{ id, code, size, status, openedAt }` i formatuje `openedAt`. `gm_id` nie dochodzi do propsów.

**Plansza MG**

- Before: `getSessionWithCells` zwraca spread komórek i `threshold_count` (`sessions.service.ts:508-528`). Wyspa czyta `data.threshold_count` (`GmBoard.tsx:171`). Strona czyta `created_at` i `replaced_by_session_id` (`sessions/[id].astro:49`, `:60`).
- After: odpowiedź `GET /api/sessions/:id/board` i props strony to `SessionBoard`: `openedAt`, `thresholdCount`, `replacedBySessionId`, komórki `{ position, phrase, reward, claimedByColor, claimedAt }`. Parser wyspy sprawdza te nazwy.

**Nowa sesja**

- Before: strona woła `.from("rewards")` i `.from("session_reward_pool")` (`sessions/new/index.astro:17-20`, `:35-37`) i czyta `source.threshold_count` (`:45`).
- After: strona woła `sessions.rewardCatalog()` i `sessions.findBoard(...)`. Reguły nagród składają się z `SessionBoard.thresholdCount`. Zapytanie PostgREST jest w adapterze.

**Logowanie**

- Before: `signin.ts:55` i `signup.ts:33` wstawiają `error.message` do URL. Strona wyświetla go surowo (`auth/signin/index.astro:9`).
- After: API wstawia kod `AuthFailure`. Formularz mapuje kod na istniejące polskie zdania. Tekst GoTrue zostaje w adapterze (log / `reportError` dla `unavailable`).

**Usługa**

- Before: `createSession(supabase, command)` i `if (sessionError.code === "23505")` (`sessions.service.ts:82`, `:144`).
- After: `createSession(store, gm, command)` i `if (!inserted.ok && inserted.failure.kind === "session_code_taken")`.

### Decyzje zależne od kontraktu biblioteki

Źródła: [Handling errors in supabase-js](https://supabase.com/docs/guides/api/handling-errors-in-supabase-js) (gałąź po `error.code` dla Auth; `PostgrestError` niesie `code`, `details`, `hint`, `message`), [Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes), typy `PostgrestSingleResponse` w [postgrest-js `src/types.ts`](https://github.com/supabase/postgrest-js/blob/master/src/types.ts) (`data: T` przy sukcesie, `data: null` przy błędzie), oraz zachowanie `null` przy sukcesie dla odpowiedzi bez ciała ([supabase/supabase#9817](https://github.com/supabase/supabase/issues/9817) — insert/update bez `.select()` oraz funkcje `void`).

1. **`data === null` przy `rpc`.** Komentarz w `sessions.service.ts:28-29` jest prawdziwy dla funkcji `RETURNS void` (`close_session_as_replaced`, `delete_session` w `database.types.ts:310-314`): sukces to `error === null` i `data === null`. Traktowanie null jako porażki psuje te wywołania. Dla funkcji `RETURNS` zestaw wierszy (join, claim, board, undo) sukces z pustym wynikiem to `[]`; null danych przy `error === null` adapter normalizuje do `[]` w jednej funkcji `rowsFromRpc` w `postgrest-error.ts`. Usługi tej funkcji nie widzą. Decyzja **nie** wraca do endpointów.

2. **Komunikat Auth.** Dokumentacja każe rozgałęziać po `error.code`, nie po tekście. Kody używane przez ten produkt: `invalid_credentials`, `email_not_confirmed` (logowanie), `email_exists` (rejestracja). `failureFromAuth` w adapterze mapuje te trzy na `AuthFailure`, a `status >= 500`, brak `code` albo nieznany kod na `unavailable`. API raportuje do Sentry tylko `unavailable`. Dzisiejszy filtr po `status` 400/401 (`signin.ts:21-24`) wykonuje tę samą rolę gorzej, bo 400 obejmuje i złe hasło, i błędy, które warto rozróżnić (`email_not_confirmed`).

3. **`23505`.** PostgREST przepisuje SQLSTATE do `error.code`. Unikalność kodu sesji jest ograniczeniem tabeli. Adapter na insercie `sessions` zamienia `23505` na `session_code_taken`. Inne `23505` (komórka, token) zostają nieznanym błędem sterownika i idą do `reportError`, tak jak dziś — usługa mapuje `23505` tylko dla kodu sesji (`sessions.service.ts:144`).

4. **`status: string` i `size: number` w typie wygenerowanym** (`database.types.ts:257-258`). CHECK w migracji zawęża wartości, typ klienta tego nie wie. `sessionFromRow` odrzuca wartość spoza `active|closed` i `3|4|5`. API dostaje wyjątek i 500, a nie surowy string w JSON.

5. **Prefiks `ERROR:` w `error.message`.** Testy oczekują mapowania `"ERROR: session_not_found"` (`delete-session.test.ts:13-14`). To format komunikatu Postgresa owinięty przez PostgREST. `failureFromPostgrest` szuka tokenów `session_not_found`, `session_full`, `invalid_nick`, `invalid_position`, `cell_not_found`, `player_not_found`, `session_not_active`, `replacement_not_found` w `message`. Cztery funkcje `*ErrorFromMessage` w usłudze znikają. Testy prefiksu przenoszą się do `src/acl/supabase/postgrest-error.test.ts`.

## 6. Weryfikacja i fazy

### Kryterium sukcesu

```bash
rg "@supabase/(supabase-js|ssr)" src tests
```

wynik zawiera wyłącznie pliki pod `src/acl/supabase/`.

Dodatkowo:

```bash
rg "SupabaseClient|__InternalSupabase|from\\(\"sessions\"\\)|auth\\.getUser|signInWithPassword" src tests
```

też wyłącznie `src/acl/supabase/`.

`rg "created_at|gm_id|threshold_count|replaced_by_session_id" src/components src/pages src/domain` nie ma trafień. Te nazwy zostają w `src/acl/supabase/` i w `supabase/migrations/`.

### Kto zna pakiet dziś, a kto po refaktorze

| Plik | Dziś | Po refaktorze |
| --- | --- | --- |
| `src/lib/supabase.ts` | import `@supabase/ssr` | plik znika; treść w `src/acl/supabase/client.ts` |
| `src/lib/services/sessions.service.ts` | import `SupabaseClient` | zna `SessionStore` |
| `src/env.d.ts` | import typu `User` | `gameMaster: GameMaster \| null` z `@/domain/game-master` |
| `src/db/database.types.ts` | schemat klienta importowany przez domenę | przeniesiony do `src/acl/supabase/database.types.ts` |
| `src/types.ts` | import `Database` | aliasy wierszy usunięte; zostają komendy i DTO camelCase |
| `src/middleware.ts` | `createClient`, `auth.getUser` | `authenticator.current()` |
| endpointy z sekcji 1 (`api/auth/*`, `api/sessions/**`, `api/play/**`) | `createClient` | `scopeFrom(...).sessions` / `.auth` |
| `src/pages/dashboard/index.astro`, `sessions/new/index.astro`, `sessions/[id].astro`, `play/[code].astro` | `createClient`, część z `.from` | port |
| `src/lib/report-error.ts` | nazwy `PostgrestError`, `__isAuthError` | zostaje przy Sentry; rozpoznawanie kształtu Auth/PostgREST przechodzi do `postgrest-error.ts`. Reporter dostaje już błąd domenowy albo zwykły `Error` |
| `src/lib/services/delete-session.test.ts`, `close-session-as-replaced.test.ts` | `SupabaseClient` | testują mapowanie w `src/acl/supabase/*.test.ts` albo usługę na sztucznym `SessionStore` |
| `tests/integration/threshold-pattern-rewards.test.ts` | `createClient` + `signInWithPassword` (`:3`, `:47-51`) | zostaje przy HTTP; jeśli test nadal potrzebuje sesji konta poza HTTP, woła funkcję z `src/acl/supabase/` i sam nie importuje pakietu |
| `src/components/dashboard/DashboardSessionList.tsx`, `GmBoard.tsx`, `PlayerBoard.tsx` | pola wiersza | pola `Session` / `SessionBoard` |
| `CLAUDE.md`, `context/foundation/infrastructure.md` | nazwa pakietu w opisie | zostają dokumentacją wyboru dostawcy; nie są warstwą wołającą SDK. Jedno zdanie w `CLAUDE.md:29` wskazuje `src/acl/supabase/` zamiast `src/lib/supabase.ts` |

### Fazy

Konwencja jak w planach zmian: cel fazy, pliki, kontrakt, kryterium automatyczne. Każda faza zostawia `npm run test:unit` i `npm run lint` zielone. Bez zmiany schematu SQL.

#### Faza 1 — Typy domenowe i porty obok obecnego kodu

Dodać `src/domain/game-master.ts`, `src/domain/session.ts`, `src/domain/game-master-authenticator.ts`, `src/domain/session-store.ts` z sygnaturami z sekcji 4. Nic ich jeszcze nie woła. `src/types.ts` zostaje.

Kontrakt: pliki domenowe nie zawierają napisu `@supabase` ani nazw kolumn `gm_id`, `created_at`, `threshold_count`.

Kryterium: `npm run test:unit`.

#### Faza 2 — Adapter i tłumacz, stara ścieżka nadal działa

Przenieść fabrykę do `src/acl/supabase/client.ts` i re-eksportować `createClient` z `src/lib/supabase.ts`, żeby nie ruszać call-site'ów w tej fazie. Przenieść `database.types.ts` pod ACL; stara ścieżka `@/db/database.types` re-eksportuje typ do końca fazy 3. Dodać `session-row.ts`, `postgrest-error.ts` i testy prefiksu `ERROR:` oraz `23505`, `invalid_credentials`, null dla `void`.

Kontrakt: testy mappera nie otwierają sieci. `sessionFromRow` odrzuca `size` spoza 3–5 i `status` spoza `active|closed`.

Kryterium: `npm run test:unit` dla `src/acl/supabase/**`.

#### Faza 3 — Usługa sesji na `SessionStore`

`sessions.service.ts` przyjmuje `SessionStore` i `GameMaster`. Implementacja `supabaseSessionStore` przejmuje `.from` i `.rpc`. Pętla kodu zostaje w usłudze i reaguje na `session_code_taken`. Funkcje `*ErrorFromMessage` usuwane po przeniesieniu testów.

Kontrakt: `rg "SupabaseClient|@supabase" src/lib` jest puste. Zachowanie HTTP bez zmian (kody 400/401/404/409/500 takie jak dziś).

Kryterium: `npm run test:unit`. Testy jednostkowe usługi dostają sztuczny `SessionStore`.

#### Faza 4 — API, middleware i strony SSR

`scopeFrom` w middleware i w każdym endpoincie oraz stronie z sekcji 1. `sessions/new/index.astro` oddaje oba `.from` do `rewardCatalog` i `findBoard`. `locals.user` zastąpione przez `locals.gameMaster`. Logowanie i rejestracja zwracają kod `AuthFailure`, a formularz tłumaczy go na dotychczasowe polskie komunikaty tam, gdzie copy już istnieje; surowy `error.message` znika z URL.

Kontrakt: `rg "createClient|@supabase" src/pages src/middleware.ts` jest puste.

Kryterium: `npm run test:unit`. Ścieżki HTTP, które dziś pokrywają testy integracyjne, przechodzą bez zmiany statusów dla join, claim, undo, close i delete.

#### Faza 5 — Wyspy dostają widok domenowy

`SessionBoard` i lista sesji bez kolumn wiersza. Zaktualizować parsery w `GmBoard.tsx` i `PlayerBoard.tsx` oraz fixtury kitchen-sink (`dashboard/kitchen-sink.astro`, `sessions/board/kitchen-sink.astro`, `play/kitchen-sink.astro`). `src/types.ts` przestaje importować `Database`. Alias `Session` jako wiersz znika.

Kontrakt: `rg "created_at|gm_id|threshold_count|replaced_by_session_id" src/components src/pages src/domain src/types.ts` jest puste.

Kryterium: `npm run lint` (w tym `lint:ui-literals` na widokach już objętych skryptem) i `npm run test:unit`.

#### Faza 6 — Bramka grepa

Usunąć re-eksporty `src/lib/supabase.ts` i `src/db/database.types.ts`. Test integracyjny `threshold-pattern-rewards.test.ts` przestaje importować `@supabase/supabase-js`. Zdanie w `CLAUDE.md:29` wskazuje katalog adaptera.

Kontrakt: oba polecenia `rg` z kryterium sukcesu.

Kryterium: `npm run test:unit` oraz, przy działającym preview, istniejące `npm run test:integration` dla planszy i nagród progowych.

### Poza zakresem

- Zmiana tabel, RLS i funkcji SQL.
- Wymiana Sentry, Zoda, `qrcode.react` i Radix.
- Nowa biblioteka auth „na zapas”. Adapter Supabase zostaje jedyną implementacją portów.
- Różne polskie zdania dla `email_not_confirmed` i `invalid_credentials`, jeśli produkt dziś pokazuje surowy tekst angielski — faza 4 wprowadza stabilny kod; dopisanie nowego copy jest osobną decyzją UX, domyślnie oba kody dostają jeden istniejący komunikat o nieudanym logowaniu, a `email_not_confirmed` osobne zdanie tylko gdy takie zdanie już jest na stronie potwierdzenia.
