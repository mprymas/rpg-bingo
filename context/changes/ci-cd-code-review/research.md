---
date: 2026-10-25T11:40:20+01:00
researcher: Marcin
git_commit: dc0a8a4ac5fba430768167ec788e1781acf1251b
branch: master
repository: mprymas/rpg-bingo
topic: "Scored pull-request code review as a separate GitHub Actions workflow"
tags: [research, codebase, github-actions, code-review, cursor-sdk]
status: complete
last_updated: 2026-10-25
last_updated_by: Marcin
---

# Research: Scored pull-request code review as a separate GitHub Actions workflow

**Date**: 2026-10-25T11:40:20+01:00
**Researcher**: Marcin
**Git Commit**: dc0a8a4ac5fba430768167ec788e1781acf1251b
**Branch**: master
**Repository**: mprymas/rpg-bingo

## Research Question

Jak osadzić przegląd pull requesta opisany w `context/changes/ci-cd-code-review/requirements.md` w tym repozytorium: cienki workflow na `master`, composite action, jednorazowe wywołanie `@cursor/sdk`, sześć ocen 1–10, komentarz i etykiety `ai-cr:*` — bez kolizji z obecnym CI i bez zgadywania, gdzie w kodzie leżą skutki, które agent ma oceniać.

## Summary

W tym checkoutcie jest jeden workflow, `.github/workflows/ci.yml`. Na `pull_request` do `master` blokują joby `ci` i `smoke` (lint, `astro check`, unit, build, potem lokalny Supabase, smoke, integracja, e2e). Job `deploy` startuje tylko przy `push` na `refs/heads/master` i potrzebuje obu poprzednich (`ci.yml:96-98`). Wymagany przegląd agenta nie jest w tym pliku: brak komentarzy, etykiet i zdarzenia `labeled`. Osobny plik workflow spełnia żądanie „osobny workflow” i nie nadpisuje `ci` / `smoke` / `deploy`.

Werdykt z `requirements.md:47` jest rozstrzygnięty dla ocen całkowitych od 1 do 10: `pass` tylko gdy każde z sześciu kryteriów ma co najmniej 7; ocena 4 albo mniej oraz ocena 5 lub 6 dają `fail`. Poza tym przedziałem i przy braku liczby wymagania milczą. Wymagania każą zostawić komentarz i jedną etykietę wyniku (`ai-cr:passed` albo `ai-cr:failed`) oraz zdjąć `ai-cr:review`. Nie mówią, że job ma kończyć się kodem niezerowym.

`@cursor/sdk` nie jest zależnością tego repo (`package.json` nie zawiera tej nazwy). Opublikowana wersja sprawdzona 2026-10-25 to `1.0.40`. W jej typach `Agent.prompt(message, options?)` zwraca `RunResult` ze `status` i opcjonalnym `result?: string`. Klucz w skillu SDK to `CURSOR_API_KEY`; w `ci.yml` ten sekret nie występuje. Dla agenta lokalnego typ wymaga `model`. `tools: []` wyłącza wbudowane narzędzia i jest dozwolone tylko dla runtime lokalnego.

Trzy fakty platformy zmieniają kształt planu: płytki `actions/checkout@v4` (domyślnie `fetch-depth: 1`, a kroki w `ci.yml:13`, `:31` i `:104` głębokości nie ustawiają) nie ma historii potrzebnej do `git diff origin/<base>...HEAD`; zdarzenie `pull_request` z forka dostaje token tylko do odczytu i nie dostaje sekretów; dopisanie etykiety wyniku przy `types: [labeled]` jest osobną aktywnością i może uruchomić workflow jeszcze raz.

## Detailed Findings

### Istniejący pipeline

- Jedyny plik pod `.github/workflows/` w tym checkoutcie to `ci.yml`. Zdarzenia: `push` i `pull_request`, gałąź `master`, bez filtra `types` (`ci.yml:3-7`). Brak klucza `permissions`. Brak `concurrency` na jobach `ci` i `smoke`. Grupa `deploy-production` z `cancel-in-progress: false` jest tylko na `deploy` (`ci.yml:100-102`).
- Joby PR: `ci` (Node 22, `npm ci`, `astro sync`, `lint`, `astro check`, `test:unit`, `build` z sekretami `SUPABASE_URL` i `SUPABASE_KEY`) oraz równoległy `smoke` (lokalny Supabase, `smoke`, `test:integration`, `test:e2e`). `deploy` używa `cloudflare/wrangler-action@v4` i sekretów `CLOUDFLARE_API_TOKEN` oraz `CLOUDFLARE_ACCOUNT_ID` (`ci.yml:124-128`).
- `GITHUB_TOKEN` nie jest w tym pliku przywołany. Katalogu `.github/actions/` i pliku `action.yml` w tym checkoutcie nie ma. Etykiet `ai-cr:*` workflow nie ustawia.
- Drugi workflow z `on.pull_request.branches: [master]` wystartuje obok `ci.yml` na tym samym pull requeście. Kolizja nazw jobów dotyczy tylko scalenia do jednego pliku. Kolizja z Workerem `rpg-bingo` dotyczy tylko drugiego `wrangler deploy`.

### Werdykt i skutek na pull requeście

- Wejście agenta, według wymagań: tytuł `pull_request.title` oraz diff `git diff origin/<base>...HEAD` jako plik (`requirements.md:9-12`). Lint, typecheck, testy, build, smoke, integracja i e2e zostają w obecnym workflow (`requirements.md:16`).
- W `requirements.md:16` każde z sześciu kryteriów dostaje ocenę od 1 (najgorzej) do 10 (najlepiej). Próg zbiorczy jest w `requirements.md:47`.
- Po przebiegu: komentarz ze skrótem i werdyktem; zielona `ai-cr:passed` przy `pass`; czerwona `ai-cr:failed` przy `fail`; zostaje etykieta bieżącego werdyktu, schodzi `ai-cr:review` (`requirements.md:51-58`).
- Dokumentacja składni Actions (pobrana 2026-10-25) podaje, że `pull-requests: write` pozwala akcji dodać etykietę do pull requesta. Ten sam dokument: gdy podasz dowolne `permissions`, niewymienione scope’y schodzą do `none`. Tworzenie brakującej etykiety w praktyce labelera wymaga `issues: write`; samo nałożenie istniejącej etykiety jest opisane jako `pull-requests: write` ([workflow syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions), [actions/labeler](https://github.com/actions/labeler/)).
- Ten sam dokument składni, przy wielu `types`, mówi że wystarczy jeden z wymienionych typów aktywności, a zbieg kilku typów uruchamia kilka runów. Przykład w akapicie dotyczy zdarzenia `issues` (`opened` i `labeled`), nie `pull_request`. Wniosek dla tego workflow: jeśli lista typów zawiera `labeled`, nałożenie `ai-cr:passed` / `ai-cr:failed` jest kolejną aktywnością `labeled`. Filtr `github.event.label.name == 'ai-cr:review'` jest warunkiem, żeby przebieg wyniku nie wołał agenta drugi raz. Tabeli typów `pull_request` w tej sesji nie pobierano ponownie.

### Sześć kryteriów — kotwice w kodzie

Agent ma oceniać diff, nie cały stan repo. Poniższe ścieżki są wzorcem, do którego „10” się odnosi. Luki legacy są w diffie tylko wtedy, gdy diff je dotyka.

1. Granica MG i gracza. `PROTECTED_ROUTES` to `["/dashboard", "/sessions"]` (`src/middleware.ts:5`). Brak użytkownika na tych prefiksach przekierowuje na `/auth/signin` (`src/middleware.ts:23-26`). `locals.user` jest ustawiane wcześniej (`src/middleware.ts:18-20`). Wejście gracza `src/pages/play/[code].astro` woła planszę po kodzie, bez wymogu `locals.user`. API MG, które w odczytanych handlerach zwraca 401 `"Wymagane logowanie"` bez `locals.user`: `src/pages/api/sessions/index.ts`, `src/pages/api/sessions/[id]/board.ts`, close, undo-claim oraz `DELETE` w `src/pages/api/sessions/[id].ts:24-25`. API gracza `/api/play/**` nie sprawdza `locals.user`; opiera się na kodzie i `claim_token` (np. `src/pages/api/play/claim.ts`). Ścieżki `/api/auth/**` i `src/pages/api/debug/sentry-probe.ts` też nie bramkują `locals.user` — auth z założenia, sonda tylko poza produkcją.

2. Izolacja stołu. Odczyt MG: RLS `gm_id = auth.uid()` w `supabase/migrations/20260927143000_sessions_and_board_cells.sql` oraz `getSessionWithCells` z `.eq("gm_id", gmId)` w `src/lib/services/sessions.service.ts`. Brak wiersza mapuje się na 404, nie na 403 (wzorzec w `src/pages/api/sessions/[id]/board.ts`). Plansza po kodzie: `getActiveBoardByCode` i RPC `get_active_board_by_code` (definicja w `supabase/migrations/20261011140000_player_board_active_or_closed.sql`). Etykieta nagrody gracza: `CASE` w tej migracji, tylko gdy `claimed_by_player_id IS NOT NULL`; mapowanie `mapPlayerBoardCell`. MG dostaje `reward (slug, label)` od razu w `getSessionWithCells`. Pierwszy claim: RPC `claim_board_cell` aktualizuje wiersz tylko przy `claimed_by_player_id IS NULL` (`supabase/migrations/20261003190000_player_claim_token.sql`). Katalog: polityki w `supabase/migrations/20260927134220_phrases_and_rewards.sql` są SELECT; w `src/` nie ma `.insert` do `phrases` / `rewards`. To brak zapisu, nie osobna polityka `DENY INSERT`.

3. Kontrakt API. Wzorzec nowych handlerów planszy: `export const prerender = false`, metoda wielkimi literami, zod w `src/lib/schemas/`, status i polski komunikat, `reportError` z `src/lib/report-error.ts`. Przykład: `src/pages/api/sessions/index.ts`, `src/pages/api/play/claim.ts`. Strony SSR przy twardej porażce odczytu ustawiają status spoza 2xx (dashboard 503; to samo na `play/[code].astro` i `sessions/[id].astro`). Lekcja zespołu mówi to samo (`context/foundation/lessons.md:12-17`). Wyjątki już w drzewie, których rubryka „10” nie opisuje jako wzorca: w `src/pages/api/auth/` grep nie znalazł `prerender`; te handlery biorą `formData` bez zoda. `DELETE` w `src/pages/api/sessions/[id].ts:19` ma `prerender = false` (`:8`) i 401, ale identyfikator sprawdza regexem, nie zodem. `AGENTS.md` każe eksportować tylko `GET` / `POST`. Tekst kryterium 3 w wymaganiach mówi o metodzie wielkimi literami i nie wymienia `DELETE` jako oceny 1.

4. Kontrakt UI. `cn()` jest w `src/lib/utils.ts`. Lista plików objętych zakazem literałów to `SCOPED_FILES` w `scripts/check-ui-literals.mjs:9-49`. `"use client"` w `src/` nie występuje (jest w dokumentach konwencji). `cursor-pointer` jest na bazowym `src/components/ui/button.tsx` i pokrywa się z lekcją `context/foundation/lessons.md:26-31`. Loadera „navigation form” jako osobnego symbolu nie ma. Wzorzec to `SubmitButton` (`useFormStatus` / pending) oraz pending na formularzach nawigacji; lekcja `context/foundation/lessons.md:19-23`.

5. Miejsce kodu i sekrety. Rodzeństwo istnieje: `src/types.ts`, `src/lib/`, `src/lib/services/`, `src/lib/schemas/`, `src/components/hooks/`. `.env.example` wymienia `SUPABASE_URL` i `SUPABASE_KEY`. `.gitignore:17` ignoruje `.env`, `.gitignore:21` ignoruje `.dev.vars`. Nazwa workera to `"rpg-bingo"` (`wrangler.jsonc:3`). `session: false` jest w `astro.config.mjs:40`.

6. Testy. Skrypty: `test:unit` (`src/**/*.test.ts`), `test:integration` (`tests/integration/`), `test:e2e` (`tests/e2e/`), oraz `smoke`. Skutek dla MG, nie kształt zapytania: `tests/integration/abuse-join-identity.test.ts` oczekuje 404 na planszy i undo obcego MG. Wyścig claimu i odsłonięcie nagrody są w `tests/integration/play-path-claim-undo.test.ts`. Test jednostkowy `src/lib/services/delete-session.test.ts` sprawdza nazwę i argumenty RPC `delete_session` — to jest bliżej kształtu wywołania niż skutku dla gracza, czyli tego, co kryterium 6 stawia na ocenie 1.

### Wywołanie `@cursor/sdk`

- W repozytorium nie ma `.cursor/skills/sdk/SKILL.md`. Skill opisujący SDK leży poza repo, w skillach Cursora użytkownika. Mówi, że powierzchnia jest w publicznej becie i że skill jest źródłem prawdy względem pamięci modelu. Jednorazowe wywołanie w skillu to `Agent.prompt`, z `apiKey: process.env.CURSOR_API_KEY` i `model: { id: "composer-2.5" }` oraz `local: { cwd }` (skill SDK, wzorzec 1). `Agent.create` plus `send` to drugi wzorzec, ze strumieniem.
- Pakiet npm `@cursor/sdk` w wersji `1.0.40` (odczyt `npm view` i `https://unpkg.com/@cursor/sdk@1.0.40/package.json` w dniu 2026-10-25) ma `"engines": { "node": ">=22.13" }`, `"type": "module"`, peer `zod` `^3.25.0 || ^4.0.0` oraz opcjonalne paczki platformowe, w tym `@cursor/sdk-linux-x64` w tej samej wersji. W tym repo `zod` to `^4.6.5` (`package.json`), `.nvmrc` to `22.14.0`, a CI ustawia `node-version: 22` bez patcha (`ci.yml:16`).
- Typy `1.0.40` (`dist/esm/stubs.d.ts`): `static prompt(message: string, options?: AgentOptions): Promise<RunResult>`. `RunResult.status` to `"finished" | "error" | "cancelled"`. `result?: string` jest opcjonalnym tekstem, nie obiektem ocen. `AgentOptions.model` jest wymagany dla agenta lokalnego i opcjonalny dla chmury. `AgentOptions.apiKey` jest opcjonalne w typie. `tools: []` oznacza brak wbudowanych narzędzi (sam tekst). Pole `tools` razem z `cloud` rzuca `ConfigurationError` — ograniczenie narzędzi jest opisane jako lokalne.
- Skill mówi, że lokalny agent działa na maszynie wywołującej, w `cwd`, i pasuje do CI z już zrobionym checkoutem. Chmura klonuje repo na VM Cursora. Skill dla chmury w CI zaleca `skipReviewerRequest: true`, jeśli człowiek nie ma dostać prośby o review. Wymagania nie wybierają modelu ani runtime. Mówią, że wywołanie jest jednorazowe, dostaje parametry i zwraca ocenę.
- `tsconfig.json:2-3` obejmuje `**/*` i wyklucza tylko `dist`. Bazowy config Astro, na który ten plik się rozszerza, ma `noEmit: true`. Skrypt `.ts` pod repo wejdzie w `astro check` i sam z siebie nie wyemituje JS. Istniejące skrypty CI są plikami `.mjs` uruchamianymi przez `node`.

### Uprawnienia, forki i diff

- Dokument [Securely using pull_request_target](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target) (stan strony w tej sesji): zdarzenie `pull_request` bierze plik workflow z merge commita pull requesta. Dla PR z forka token jest tylko do odczytu, sekrety nie dochodzą, a `actions/checkout` domyślnie bierze merge commit. `pull_request_target` bierze workflow z domyślnej gałęzi bazy i może dostać sekrety oraz token z zapisem, pod warunkiem że kod forka nie jest wykonywany. Dla PR z gałęzi w tym samym repozytorium różnicy uprawnień między tymi dwoma zdarzeniami ten dokument nie opisuje jako osobnego ograniczenia forka.
- Wymagania potrzebują i sekretu (`CURSOR_API_KEY`), i zapisu komentarza oraz etykiet. Na `pull_request` z forka oba są niedostępne. `pull_request_target` plus lokalny agent z narzędziami w katalogu checkoutu PR jest wzorcem, przed którym ta sama dokumentacja ostrzega (wykonanie kodu PR przy sekretach).
- `actions/checkout` w README v4: domyślna liczba commitów to 1. Trzy kropki w `git diff origin/<base>...HEAD` potrzebują merge-base. Kroki checkout w `ci.yml` tego nie ustawiają, bo tamten workflow diffu trzy-kropkowego nie liczy.

### Inny, niezrealizowany kontrakt review

Skill `.cursor/skills/10x-impl-review-ci/SKILL.md` opisuje przegląd względem `plan.md`, nie względem sześciu kryteriów domenowych. Bez planu komentuje PR i kończy się kodem 0 (`SKILL.md:63-72`). Werdykty wymiarów to PASS / WARNING / FAIL, zbiorczo APPROVED / NEEDS ATTENTION / REJECTED (`references/impl-review-instructions.md:111-115`). Bramka `REJECTED` ma żyć w kroku workflow i puszczać etykietę `impl-review-override` (`SKILL.md:410-411`, `SKILL.md:501-502`). Skill zapisuje raport do brancha. W `.github/workflows/` tego mechanizmu nie ma — jest procedura agenta, nie działający workflow. Wymagania `ci-cd-code-review` tego kontraktu nie przyjmują: brak progu 7, brak etykiet `ai-cr:*`, brak porównania z planem.

## Code References

- `.github/workflows/ci.yml:3-7` — jedyny plik workflow w tym checkoutcie; `push` i `pull_request` na `master`, bez `permissions` i bez `types`
- `.github/workflows/ci.yml:10-26` — job `ci`, Node 22, sekrety Supabase przy buildzie
- `.github/workflows/ci.yml:96-128` — `deploy` tylko na push do `master`, po `ci` i `smoke`
- `wrangler.jsonc:3` — `"name": "rpg-bingo"`
- `astro.config.mjs:40` — `session: false`
- `src/middleware.ts:5` — `PROTECTED_ROUTES`
- `src/pages/api/sessions/[id].ts:8-25` — `prerender`, `DELETE`, 401
- `scripts/check-ui-literals.mjs:9-49` — `SCOPED_FILES`
- `package.json` — `zod` `^4.6.5`; brak `@cursor/sdk`
- `context/changes/ci-cd-code-review/requirements.md:47-58` — progi werdyktu, komentarz, etykiety
- `context/foundation/lessons.md:12-31` — status spoza 2xx, loader, `cursor-pointer`
- `context/foundation/test-plan.md:96` — wiersz „AI-native / none planned”
- `.cursor/skills/10x-impl-review-ci/SKILL.md:63-72` — brak planu kończy review kodem 0

## Architecture Insights

Przegląd z wymagań jest bramą obok deterministycznego CI, nie jego zamiennikiem. Joby `ci` i `smoke` już pokrywają lint, typecheck, unit, build, smoke, integrację i e2e. Agent ma oceniać skutki w diffie (granica MG/gracz, izolacja stołu, kontrakt HTTP, tokeny UI, miejsce kodu, warstwa testu).

Composite action w wymaganiach jest cienką warstwą nad jednym wywołaniem. W tym repo naturalny nośnik to krok `node` w akcji composite, analogicznie do `scripts/*.mjs`, a nie plik `.ts` wciągany przez `include: ["**/*"]` i `astro check`.

W typach `@cursor/sdk@1.0.40` metoda opisana jako jedno wywołanie, jedna odpowiedź i zamknięcie to `Agent.prompt`. `AgentOptions.tools: []` (te same opcje bierze też `Agent.create`) oznacza brak wbudowanych narzędzi i jest odrzucane razem z `cloud` (`ConfigurationError` w komentarzu typu). `RunResult.result` jest opcjonalnym stringiem, a `status` może być `finished`, `error` albo `cancelled`. Typ nie niesie obiektu z sześcioma ocenami. Wymagania nie definiują, co zrobić, gdy tekst nie da się odczytać jako werdykt.

## Historical Context (from prior changes)

Każde zdanie osobno, względem kodu na `dc0a8a4`:

- `context/foundation/infrastructure.md:82` — „CI w repo nie deployuje”. **Sprzeczne** z jobem `deploy` w `ci.yml:96-128`.
- `context/foundation/infrastructure.md:79` — nazwa workera nadal `10x-astro-starter`. **Sprzeczne** z `wrangler.jsonc:3` (`rpg-bingo`).
- `context/foundation/infrastructure.md:120` — recepta joba `deploy` (`needs: [ci, smoke]`, tylko push na `master`, `wrangler-action@v4`). **Zgodne** z `ci.yml:96-128`.
- `context/foundation/infrastructure.md:127` — pełny pipeline poza mechanizmem deployu był poza zakresem tamtego researchu. **Zgodne jako opis zakresu tamtego dokumentu.** Nie jest zakazem tego change’u.
- `context/foundation/infrastructure.md:86` — smoke na forkach zostaje w GitHub Actions, bo forki nie dostają sekretów. **Zgodne** z obecnym jobem `smoke` (lokalny Supabase, bez sekretów GitHuba w tym jobie) i z dokumentacją `pull_request` dla forków.
- `context/foundation/test-plan.md:96` — „AI-native / none planned”. **Zgodne z żywym CI** (w `ci.yml` nie ma joba agenta). **Nieaktualne jako plan**: request `ci-cd-code-review` ten przegląd już opisuje. Reszta tabeli gate’ów (lint, smoke, unit, integracja, e2e) pozostaje opisem jobów `ci` i `smoke`.
- Archiwalne change’e testowe (runner, play-path, abuse, Sentry) zmieniały job `smoke` albo env deployu. Żaden z odczytanych fragmentów foundation nie ustala etykiet `ai-cr:*` ani wywołania `@cursor/sdk`. Ręczne `reviews/impl-review.md` w archiwum to artefakty `/10x-impl-review`, nie workflow.

## Related Research

- `context/foundation/infrastructure.md` — mechanizm deployu i sekrety CI. Zdania o braku deployu i o nazwie workera są sprzeczne z drzewem; recepta w Getting Started jest zgodna.
- `context/foundation/test-plan.md` — gate’y deterministyczne. Wiersz AI-native nie opisuje tego change’u.
- `.cursor/skills/10x-impl-review-ci/SKILL.md` — inny kontrakt review (plan, APPROVED/NEEDS ATTENTION/REJECTED). Nie jest zaimplementowany jako workflow.

Osobnego `research.md` o przeglądzie agenta w `context/changes/` ani w przejrzanym archive, poza tym change’em, wyszukiwanie nie wskazało.

## Open Questions

Rozstrzygnięcia produktowe, których wymagania nie domykają:

- Czy `fail` ma kończyć job kodem niezerowym, czy tylko etykietą i komentarzem. Wymagania opisują to drugie. Blokowanie merge byłoby dodatkowym gate’m obok `ci` i `smoke`.
- Czy każdy przebieg dodaje nowy komentarz, czy aktualizuje jeden. Deduplikacji wymagania nie opisują.
- Kto zakłada trzy etykiety i jaki hex dostaje „zielona” / „czerwona”. Założenie etykiety z workflow potrzebuje `issues: write`; nałożenie istniejącej jest w dokumentacji pod `pull-requests: write`.
- Identyfikator modelu. Typy `1.0.40` wymagają go dla runtime lokalnego. Skill podaje `composer-2.5` i `auto` jako wybory konta, nie jako kontrakt tego repo.
- Czy pull requesty z forków są w zakresie. Na `pull_request` nie da się ich oetykietować ani podać im `CURSOR_API_KEY`. `pull_request_target` to inny model zaufania.
- Co zrobić, gdy `result` nie jest JSON-em, ocena jest spoza 1–10, albo `status` to `error` / `cancelled`.
- Czy równoległe `synchronize` i wolniejszy poprzedni przebieg mają grupę `concurrency` na numer PR. W `ci.yml` takiej grupy dla PR nie ma.

Luka dowodowa, która nie blokuje planu, jeśli plan przypnie wersję przy implementacji: zachowanie runtime `Agent.prompt` (czas, narzędzia przy `tools: []`, kształt tekstu) sprawdzono w typach `1.0.40` i w skillu, nie przez uruchomienie agenta.
