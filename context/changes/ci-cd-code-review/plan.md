# Scored pull-request review — Implementation Plan

## Overview

Osobny workflow GitHub Actions recenzuje pull request do `master` jednym wywołaniem `@cursor/sdk`. Skrypt liczy werdykt z sześciu ocen, dopisuje komentarz i zostawia jedną etykietę wyniku. Model wybiera jednorazowy eval promptfoo na trzech tych samych diffach, zanim workflow zacznie wołać agenta.

## Current State Analysis

W tym checkoutcie jest jeden workflow, `.github/workflows/ci.yml`. Na `pull_request` do `master` joby `ci` i `smoke` blokują merge (lint, `astro check`, unit, build, lokalny Supabase, smoke, integracja, e2e). `deploy` startuje tylko na `push` do `master` i potrzebuje obu (`ci.yml:96-98`). W pliku nie ma komentarzy, etykiet ani zdarzenia `labeled`. Katalogu `.github/actions/` nie ma.

`@cursor/sdk` nie jest zależnością aplikacji. Wersja sprawdzona w researchu to `1.0.40` (`engines.node >= 22.13`). `Agent.prompt` zwraca `status` (`finished`, `error`, `cancelled`) i opcjonalny `result?: string`. `tools: []` jest dozwolone tylko dla runtime lokalnego. CI ustawia Node `22` bez patcha (`.github/workflows/ci.yml:16`); `.nvmrc` to `22.14.0`. Promptfoo (`0.122.0` w dniu planu) wymaga Node `>= 22.22.0` i nie jest w tym repo.

`tsconfig.json` obejmuje `**/*` i wyklucza tylko `dist`. Plik `.ts` w repo wchodzi w `astro check`. Skrypty CI to `.mjs` uruchamiane przez `node`. ESLint ma osobny blok bez type-check tylko dla `scripts/**/*.mjs` i `.cursor/hooks/**/*.mjs` (`eslint.config.js:77-82`). Vitest unit obejmuje `tests/unit/**/*.test.ts` (`vitest.config.ts:39`); katalogu `tests/unit/` jeszcze nie ma.

## Desired End State

Na pull requeście z tego samego repozytorium każdy `opened`, `synchronize`, `reopened` oraz etykieta `ai-cr:review` dopisuje nowy komentarz: sześć ocen ze zdaniem i linia werdyktu. Zostaje jedna etykieta wyniku (`ai-cr:passed` albo `ai-cr:failed`), a `ai-cr:review` schodzi. Job jest zielony i przy `pass`, i przy `fail`. Awaria przebiegu jest czerwonym jobem bez etykiety wyniku. Pull request z forka kończy się zielonym jobem bez agenta, bez komentarza i bez zmiany etykiet. `ci.yml` zostaje bramką lintu, testów i deployu. Identyfikator modelu w akcji jest tym, który wygrał eval.

### Key Discoveries:

- Drugi plik workflow na `pull_request` do `master` startuje obok `ci.yml`. Kolizja nazw jobów dotyczy tylko scalenia do jednego pliku (research, „Istniejący pipeline”).
- `GITHUB_TOKEN` przy `labeled` / `unlabeled` nie uruchamia kolejnego przebiegu. Filtr na nazwę etykiety i tak jest potrzebny, bo ręczna inna etykieta też jest aktywnością `labeled`.
- Na `pull_request` z forka sekrety nie dochodzą, a zapis etykiet i komentarzy jest odbierany. `pull_request_target` ten plan odrzuca.
- Płytki checkout (`fetch-depth` nieustawiony w `ci.yml:13`) nie ma merge-base dla `git diff origin/<base>...HEAD`.
- Import `@cursor/sdk` spoza `src/` nie wchodzi do bundla Workera (`wrangler.jsonc` wskazuje `sentry.server.config.ts`).

## What We're NOT Doing

- Zmiany w `.github/workflows/ci.yml`, w jobach `smoke` i `deploy`, oraz drugi `wrangler deploy`.
- `pull_request_target`, branch protection i wymagany check na ten workflow.
- Czerwony job przy werdykcie jakościowym `fail`.
- Aktualizacja jednego komentarza w miejscu. Każdy przebieg dopisuje nowy.
- Workflow `/10x-impl-review-ci` (PASS / WARNING / FAIL, etykieta `impl-review-override`, zapis raportu na branch).
- Modele z szablonu kursu (`m5l3-promptfooconfig.yaml.template`: OpenRouter, glm, deepseek, gpt) i asercja `llm-rubric`.
- Dopisanie `@cursor/sdk` albo `promptfoo` do `package.json` aplikacji, podbicie `.nvmrc` i odpalanie promptfoo w GitHub Actions.
- Narzędzia agenta, runtime chmurowy, ponowna recenzja przy samym `edited` tytułu.
- Zmiana koloru etykiety, która już istnieje.

## Implementation Approach

Jedna composite action trzyma prompt, parser, próg i wywołanie `Agent.prompt`. Workflow tylko wyzwala, liczy diff i przekazuje sekrety. Werdykt liczy skrypt z sześciu liczb całkowitych. Słowo werdyktu zwrócone przez model nie wchodzi do progu.

Eval promptfoo woła ten sam plik promptu przez cienki provider na `@cursor/sdk`, trzy razy na tych samych trzech diffach. Wynik zapisuje identyfikator modelu w jednym module akcji. Workflow tego identyfikatora nie powtarza.

Logika progu jest w `.mjs` importowanym z `tests/unit`, bez SDK. SDK jest tylko w `package.json` akcji, przypięty do `1.0.40`.

## Critical Implementation Details

- **Fork a kolor joba.** Pominięcie forka to zielony job, w którym kroki checkoutu, diffa i akcji są pominięte. Job z `if` na całym jobie pokazuje się jako skipped. Predykat: `head.repo` jest null albo `head.repo.full_name` różni się od `base.repo.full_name`. Sekret `CURSOR_API_KEY` jest tylko na kroku akcji.
- **HEAD to sha głowy PR.** `actions/checkout@v4` na `pull_request` domyślnie bierze merge commit. Checkout z `ref: github.event.pull_request.head.sha` i `fetch-depth: 0`, potem `git diff origin/<base>...HEAD`, daje trzy kropki z wymagań względem głowy PR.
- **Pętla etykiet.** Nałożenie `ai-cr:passed` albo `ai-cr:failed` tokenem `GITHUB_TOKEN` nie startuje tego workflowu ponownie. Warunek joba i tak brzmi: akcja inna niż `labeled`, albo nazwa etykiety to `ai-cr:review`.
- **Dwa Node.** Job recenzji zostaje na `22.14.0` (`.nvmrc`, SDK `>= 22.13`). Promptfoo `>= 22.22.0` dotyczy tylko lokalnego evala w fazie 2. `.nvmrc` i `ci.yml` bez zmian.
- **Identyfikatory modeli.** Kandydaci to dokładnie nazwy `composer-2.5`, `grok-4.7`, `sonnet-5.5`. Przed evalem `Cursor.models.list()` rozstrzyga każdą nazwę: dokładne dopasowanie, a gdy go nie ma — jedyny identyfikator zawierający tę nazwę. Zero albo więcej niż jedno trafienie przerywa eval i wypisuje listę. Brak zgadywania sufiksów `fast` / `high`.
- **Kolejność zapisu modelu.** Faza 1 zostawia pusty identyfikator. Puste pole jest awarią („brak identyfikatora modelu”) i nie woła SDK. Faza 2 wpisuje zwycięzcę. Faza 3 podłącza workflow dopiero wtedy.

## Phase 1: Akcja recenzji

### Overview

Powstaje composite action: czysta logika werdyktu z testami, prompt, parser, komentarz, etykiety i jednorazowe `Agent.prompt`. Identyfikator modelu jest jeszcze pusty.

### Changes Required:

#### 1. Logika werdyktu i komentarza

**File**: `.github/actions/code-review/prompt.mjs`, `.github/actions/code-review/prompt.txt`, `.github/actions/code-review/model-id.mjs`

**Intent**: Jedno miejsce liczy próg, treść komentarza i przejścia etykiet, żeby eval i job użyły tej samej reguły.

**Contract**: `prompt.txt` niesie sześć kryteriów z `requirements.md` (kotwice 1 i 10), tytuł `{{title}}`, diff `{{diff}}` i polecenie zwrotu jednego obiektu JSON. Klucze ocen i zdań: `mg_player_boundary`, `table_isolation`, `api_contract`, `ui_contract`, `code_placement`, `test_layer`. Nazwy w komentarzu: Granica MG i gracza, Izolacja stołu, Kontrakt API i status błędu, Kontrakt UI, Miejsce kodu i sekrety, Test zachowania.

`parseReview(text)` zdejmuje ogrodzenie markdown, czyta jeden obiekt i zwraca sześć liczb albo sygnał „nieczytelne”. Liczba całkowita spoza 1–10, ułamek, brak klucza albo drugi obiekt JSON to „nieczytelne”. Puste zdanie przy poprawnych liczbach staje się `Brak zdania w odpowiedzi agenta.` i nie psuje werdyktu.

`verdict(scores)` zwraca `pass` tylko gdy każda liczba jest całkowita od 7 do 10. Każda liczba całkowita od 1 do 6 daje `fail`.

`labelPlan(kind)` dla `pass`: dodać `ai-cr:passed`, zdjąć `ai-cr:failed` i `ai-cr:review`, kod 0. Dla `fail`: dodać `ai-cr:failed`, zdjąć `ai-cr:passed` i `ai-cr:review`, kod 0. Dla `infra`: niczego nie dodawać, zdjąć `ai-cr:passed` i `ai-cr:failed`, `ai-cr:review` zostawić, kod 1.

Komentarz zawsze zaczyna się od `<!-- ai-cr-review -->` i kończy linią `Przebieg: <url>`. Przy ocenach: sześć linii `Nazwa — N/10 — zdanie`, potem `Werdykt: pass` albo `Werdykt: fail`. Przy `fail` dodatkowo `Poniżej 7:` i nazwy tych kryteriów. Przy tekście nieczytelnym, już na kanale `fail`: `Recenzja nie dała sześciu liczb całkowitych od 1 do 10.` i `Werdykt: fail`, bez wymyślonych ocen. Przy `infra`: `Recenzja nie doszła do werdyktu: <powód>.` Powody: brak `CURSOR_API_KEY`, błąd startu agenta, status error, status cancelled, diff powyżej 200000 bajtów, brak identyfikatora modelu.

`isFork(headFullName, baseFullName)` jest prawdziwe, gdy głowa jest pusta albo różni się od bazy. `diffTooLarge(byteLength)` jest prawdziwe powyżej 200000 bajtów.

`model-id.mjs` eksportuje `REVIEW_MODEL_ID` jako pusty string.

#### 2. Wywołanie agenta i zapis na PR

**File**: `.github/actions/code-review/review.mjs`, `.github/actions/code-review/action.yml`, `.github/actions/code-review/package.json`, `.github/actions/code-review/package-lock.json`

**Intent**: Akcja woła lokalnego agenta raz, dopisuje komentarz i ustawia etykiety według `labelPlan`.

**Contract**: `package.json` akcji zależy od `@cursor/sdk` w wersji dokładnie `1.0.40` i ma własny lockfile. Aplikacyjny `package.json` bez tego pakietu. `action.yml` jest composite: Node `22.14.0`, `npm ci` w katalogu akcji, potem `node review.mjs`. Wejścia: ścieżka diffa, tytuł, `owner/repo`, numer PR, token, klucz Cursora, URL przebiegu.

`review.mjs` czyta diff z pliku. Pusty identyfikator modelu, brak klucza, diff ponad limit albo rzucony `CursorAgentError` idą w `infra` i nie wołają agenta (przy błędzie startu wywołanie już padło). `Agent.prompt` dostaje treść `prompt.txt` po podstawieniu tytułu i diffa, `apiKey`, `model: { id: REVIEW_MODEL_ID }`, `local: { cwd }` ustawiony na katalog repozytorium i `tools: []`. `status` `error` albo `cancelled` to `infra`. `status` `finished` z nieczytelnym `result` to kanał `fail`. `status` `finished` z sześcioma liczbami używa `verdict(scores)`.

Zapis: utworzyć brakującą etykietę (istniejącej nie przemalowywać). Kolory bez `#`: `ai-cr:passed` `0e8a16`, `ai-cr:failed` `d73a4a`, `ai-cr:review` `fbca04`. Potem zdjąć i nałożyć według `labelPlan` i zawsze `POST` nowego komentarza issue. Kod wyjścia procesu to kod z `labelPlan`.

#### 3. Testy i lint skryptów akcji

**File**: `tests/unit/code-review-verdict.test.ts`, `eslint.config.js`

**Intent**: Próg i komentarz da się sprawdzić bez klucza i bez GitHuba. ESLint nie wciska type-checku w `.mjs` akcji.

**Contract**: Testy importują `prompt.mjs`. Pokrywają `pass` przy samych 7–10, `fail` przy 6 i przy 4, nieczytelny tekst (ułamek, 0, 11, brak klucza, dwa obiekty, proza), zdjęcie ogrodzenia markdown, puste zdanie, trzy plany etykiet, kształt komentarza, fork i limit 200000. `scriptsConfig.files` obejmuje też `.github/actions/**/*.mjs`.

### Success Criteria:

#### Automated Verification:

- Unit tests pass for verdict, parse, label transitions, comment text, fork detection, and the 200000-byte diff cap (`npm run test:unit`)
- Lint passes (`npm run lint`)

**Implementation Note**: Po zielonych testach i lincie zatrzymaj się na ręcznym potwierdzeniu, że faza 1 jest domknięta, zanim ruszy eval modelu.

---

## Phase 2: Dobór modelu

### Overview

Ten sam prompt i trzy fixture’owe diffa idą przez `composer-2.5`, `grok-4.7` i `sonnet-5.5`. Reguła wyboru wpisuje jeden identyfikator do `model-id.mjs`.

### Changes Required:

#### 1. Fixture i konfiguracja promptfoo

**File**: `evals/code-review/promptfooconfig.yaml`, `evals/code-review/fixtures/secret-in-diff.diff`, `evals/code-review/fixtures/mg-route-without-auth.diff`, `evals/code-review/fixtures/clean-handler.diff`, `evals/code-review/assert.mjs`

**Intent**: Krótki, porównywalny zestaw na domenie tego repo, graded tą samą funkcją co job.

**Contract**: Trzy providery `file://` wskazują provider akcji. Każdy ma w configu jedną z nazw `composer-2.5`, `grok-4.7`, `sonnet-5.5`. Prompt to `file://` na `.github/actions/code-review/prompt.txt`. Każdy test podstawia ten sam `{{title}}` i `{{diff}}` wszystkim modelom.

Fixture `secret-in-diff`: patch dopisuje `SUPABASE_KEY` do pliku śledzonego w repo. Oczekiwany werdykt `fail`. Pasmo `code_placement` 1–4. Zdanie tego kryterium pasuje do `/supabase_key|sekret/i`.

Fixture `mg-route-without-auth`: nowy handler pod sesją MG bez sprawdzenia `locals.user` i bez testu. Oczekiwany werdykt `fail`. Pasmo `mg_player_boundary` 1–4. Zdanie pasuje do `/locals\.user|401|logowan/i`.

Fixture `clean-handler`: handler z `prerender = false`, zodem, 401 i polskim komunikatem, `reportError` oraz testem integracyjnym tego 401. Oczekiwany werdykt `pass`. Każde z sześciu pasm 7–10.

`assert.mjs` uznaje fixture za zaliczony, gdy `parseReview` da sześć liczb, `verdict` równa się oczekiwanemu i każde pasmo oraz fraza z fixture’a zachodzą. `llm-rubric` nie występuje.

#### 2. Provider i reguła zwycięzcy

**File**: `.github/actions/code-review/cursor-provider.mjs`, `.github/actions/code-review/select-winner.mjs`, `tests/unit/code-review-winner.test.ts`

**Intent**: Eval woła SDK tak jak job, a wybór modelu jest funkcją, nie opinią po fakcie.

**Contract**: Provider w `callApi` rozwiązuje nazwę z configu przez `Cursor.models.list()` według reguły z Critical Implementation Details, potem `Agent.prompt` z `tools: []` i lokalnym `cwd`. Nie czyta `REVIEW_MODEL_ID`.

`selectWinner(rows)` dostaje `{ modelId, fixturesPassed }` dla trzech modeli, `fixturesPassed` od 0 do 3. Do puli wchodzą wyniki `>= 2`. Brak takiej puli zwraca `null` i `REVIEW_MODEL_ID` zostaje pusty. Przy remisie wygrywa rozwiązany identyfikator `composer-2.5`, potem `grok-4.7`, potem `sonnet-5.5`. Test jednostkowy pokrywa próg 2 z 3 i tę kolejność remisu. Po przebiegu evala faza wpisuje zwrócony identyfikator do `model-id.mjs`. `null` zostawia plik pusty i faza się nie domyka.

### Success Criteria:

#### Automated Verification:

- Unit tests pass for winner selection, the 2-of-3 bar, the composer-2.5 tie-break, and the three model names plus three fixtures in the eval config (`npm run test:unit`)

#### Manual Verification:

- Promptfoo eval on Node >= 22.22 with CURSOR_API_KEY writes the winning model id, or leaves it unset when no model passes at least 2 of 3 fixtures

**Implementation Note**: Eval jest lokalny i płatny kluczem. Po zapisie identyfikatora albo świadomym pustym wyniku zatrzymaj się na potwierdzenie ręczne, zanim powstanie workflow.

---

## Phase 3: Cienki workflow

### Overview

Nowy plik workflow odpala akcję na pull requestach do `master` i pomija forki zielonym jobem. `ci.yml` bez edycji.

### Changes Required:

#### 1. Workflow

**File**: `.github/workflows/code-review.yml`

**Intent**: Wyzwalacz, uprawnienia i diff zostają w pliku, który da się przeczytać bez wchodzenia w SDK.

**Contract**: Nazwa joba `review`. Zdarzenie `pull_request` na gałąź `master`, typy `opened`, `synchronize`, `reopened`, `labeled`. Job działa, gdy akcja nie jest `labeled` albo etykieta to `ai-cr:review`.

```yaml
permissions:
  contents: read
  pull-requests: write
  issues: write
concurrency:
  group: ai-cr-${{ github.event.pull_request.number }}
  cancel-in-progress: true
```

Krok forka czyta tylko payload i przy forku ustawia output, po którym checkout, diff i akcja są pominięte. Checkout: `actions/checkout@v4`, `ref` = `github.event.pull_request.head.sha`, `fetch-depth: 0`. Diff: `git diff origin/<base>...HEAD` do pliku, `<base>` to `github.event.pull_request.base.ref`. Akcja dostaje ten plik, `pull_request.title`, token `GITHUB_TOKEN` i sekret `CURSOR_API_KEY`.

#### 2. Test kontraktu workflow

**File**: `tests/unit/code-review-workflow.test.ts`

**Intent**: Regresja nie scala recenzji z `ci.yml` i nie gubi wyzwalacza.

**Contract**: Test czyta `code-review.yml` i sprawdza cztery typy zdarzeń, trzy uprawnienia, grupę `ai-cr-` z `cancel-in-progress: true`, `fetch-depth: 0`, ref głowy PR i pominięcie kroków przy forku. Test czyta `ci.yml` i sprawdza brak `ai-cr` oraz brak `@cursor/sdk`.

### Success Criteria:

#### Automated Verification:

- Unit test passes for the workflow contract and for ci.yml staying free of ai-cr (`npm run test:unit`)
- Lint passes (`npm run lint`)

#### Manual Verification:

- Repository secret CURSOR_API_KEY exists
- A same-repo pull request gets a new comment on each push and exactly one result label, with a green job for both pass and fail
- Adding ai-cr:review starts a run, and a verdict run removes ai-cr:review
- A run that cannot reach a verdict exits non-zero, comments that it did not, clears ai-cr:passed and ai-cr:failed, and leaves ai-cr:review
- A fork pull request finishes green with no review comment and no ai-cr label change

**Implementation Note**: Sekret zakłada człowiek. Po zielonym lincie i teście kontraktu zatrzymaj się na pięć sprawdzeń ręcznych powyżej.

---

## Testing Strategy

### Unit Tests:

- Próg: same 7–10 to `pass`; 6 i 4 to `fail`; wartości spoza 1–10 i nie-całkowite to tekst nieczytelny.
- Parser: ogrodzenie markdown, jeden obiekt, dwa obiekty, puste zdanie.
- Etykiety i kody wyjścia dla `pass`, `fail`, `infra`.
- Komentarz: sześć polskich nazw, linia werdyktu, lista kryteriów poniżej 7, osobny tekst awarii i nieczytelnej odpowiedzi.
- Fork i limit 200000 bajtów.
- `selectWinner`: poniżej 2 z 3 zwraca `null`; remis idzie w `composer-2.5`, potem `grok-4.7`, potem `sonnet-5.5`.
- Plik workflow ma uzgodniony kontrakt, a `ci.yml` nie zawiera `ai-cr`.

### Integration Tests:

- Brak testu HTTP przeciwko GitHubowi i brak wywołania SDK w `npm run test:unit`.
- Eval promptfoo jest ręcznym przebiegiem fazy 2, nie jobem `ci` ani `smoke`.

### Manual Testing Steps:

1. Na Node `>= 22.22` ustaw `CURSOR_API_KEY` i uruchom promptfoo z `evals/code-review/promptfooconfig.yaml`.
2. Porównaj `REVIEW_MODEL_ID` z tabelą zaliczonych fixture’ów i regułą 2 z 3.
3. Dodaj ten sam klucz jako sekret repozytorium.
4. Otwórz pull request z gałęzi tego repozytorium, dopchnij drugi commit i sprawdź dwa komentarze oraz jedną etykietę wyniku. Job zostaje zielony.
5. Nałóż `ai-cr:review` i sprawdź kolejny przebieg oraz zdjęcie tej etykiety po werdykcie.
6. Powtórz przebieg ze złym kluczem i sprawdź czerwony job, komentarz o braku werdyktu i brak etykiet wyniku.
7. Jeśli jest fork, otwórz z niego pull request i sprawdź zielony job bez komentarza recenzji.

## Performance Considerations

Wolny krok to jedno wywołanie agenta. Grupa `ai-cr-<numer PR>` z `cancel-in-progress: true` ubija starszy przebieg tego samego PR. Diff powyżej 200000 bajtów nie idzie do modelu. Anulowany przebieg, który zdążył napisać komentarz, może zostać w wątku obok nowszego. Nowsza etykieta i tak pochodzi z przebiegu, który dokończył pracę.

## Migration Notes

Pierwszy przebieg z tego repozytorium zakłada brakujące etykiety i nie zmienia koloru etykiet już obecnych. Otwarte pull requesty dostaną recenzję przy następnym pushu albo po nałożeniu `ai-cr:review`. Historii starych PR ten plan nie uzupełnia.

## References

- Related research: `context/changes/ci-cd-code-review/research.md`
- Requirements: `context/changes/ci-cd-code-review/requirements.md`
- Existing pipeline: `.github/workflows/ci.yml:3-7`, `.github/workflows/ci.yml:13-16`, `.github/workflows/ci.yml:96-128`
- ESLint scripts override: `eslint.config.js:77-82`
- Vitest unit include: `vitest.config.ts:38-39`
- Worker entry: `wrangler.jsonc` (`main` → `sentry.server.config.ts`)
- Promptfoo shape to adapt, with different providers: `.cursor/config-templates/m5l3-promptfooconfig.yaml.template`
- SDK one-shot: `Agent.prompt`, model required for local, `CURSOR_API_KEY`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Akcja recenzji

#### Automated

- [x] 1.1 Unit tests pass for verdict, parse, label transitions, comment text, fork detection, and the 200000-byte diff cap (`npm run test:unit`)
- [x] 1.2 Lint passes (`npm run lint`)

### Phase 2: Dobór modelu

#### Automated

- [ ] 2.1 Unit tests pass for winner selection, the 2-of-3 bar, the composer-2.5 tie-break, and the three model names plus three fixtures in the eval config (`npm run test:unit`)

#### Manual

- [ ] 2.2 Promptfoo eval on Node >= 22.22 with CURSOR_API_KEY writes the winning model id, or leaves it unset when no model passes at least 2 of 3 fixtures

### Phase 3: Cienki workflow

#### Automated

- [ ] 3.1 Unit test passes for the workflow contract and for ci.yml staying free of ai-cr (`npm run test:unit`)
- [ ] 3.2 Lint passes (`npm run lint`)

#### Manual

- [ ] 3.3 Repository secret CURSOR_API_KEY exists
- [ ] 3.4 A same-repo pull request gets a new comment on each push and exactly one result label, with a green job for both pass and fail
- [ ] 3.5 Adding ai-cr:review starts a run, and a verdict run removes ai-cr:review
- [ ] 3.6 A run that cannot reach a verdict exits non-zero, comments that it did not, clears ai-cr:passed and ai-cr:failed, and leaves ai-cr:review
- [ ] 3.7 A fork pull request finishes green with no review comment and no ai-cr label change
