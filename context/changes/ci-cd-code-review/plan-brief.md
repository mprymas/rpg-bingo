# Scored pull-request review — Plan Brief

> Full plan: `context/changes/ci-cd-code-review/plan.md`
> Research: `context/changes/ci-cd-code-review/research.md`

## What & Why

Osobny workflow ma oceniać diff pull requesta do `master` sześcioma kryteriami z wymagań i zostawiać komentarz oraz jedną etykietę. Lint, testy, build i smoke zostają w obecnym `ci.yml`. Model nie jest wybrany z góry: krótki eval promptfoo na tych samych diffach porównuje `composer-2.5`, `grok-4.7` i `claude-sonnet-5-5`.

## Starting Point

Jest jeden workflow, `.github/workflows/ci.yml`, bez komentarzy, etykiet i bez `@cursor/sdk`. Research na `dc0a8a4` mapuje kotwice sześciu kryteriów w kodzie i typ `Agent.prompt` w `@cursor/sdk@1.0.40`.

## Desired End State

Pull request z tego repozytorium dostaje przy każdym pushu nowy komentarz (sześć ocen, po jednym zdaniu, werdykt) i dokładnie jedną etykietę `ai-cr:passed` albo `ai-cr:failed`. Job recenzji jest przy tym zielony. Awaria agenta jest czerwonym jobem bez etykiety wyniku. Fork kończy się zielono, bez recenzji. Identyfikator w akcji to zwycięzca evala.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Miejsce workflow | Osobny plik, `ci.yml` bez zmian | Recenzja stoi obok jobów `ci`, `smoke` i `deploy` | Research |
| Fork | Zielony job, bez agenta, bez komentarza i bez etykiet | Na `pull_request` fork nie dostaje sekretu ani zapisu | Plan |
| Werdykt a check | `pass` i `fail` kończą się kodem 0 | Oczekiwany rezultat to komentarz i etykieta; merge blokują `ci` i `smoke` | Plan |
| Komentarz | Nowy wpis przy każdym przebiegu | Historia ocen między pushami ma zostać w wątku | Plan |
| Skrót | Ocena, jedno zdanie, linia werdyktu | Przy `fail` widać kryteria poniżej 7 bez logu agenta | Plan |
| Awaria a zły tekst | Awaria: kod 1, bez etykiet wyniku, `ai-cr:review` zostaje. Tekst bez sześciu liczb 1–10: kanał `fail` | Brak klucza nie wygląda jak zła jakość kodu | Plan |
| Próg | Liczy skrypt, nie model | `pass` tylko przy sześciu liczbach całkowitych ≥ 7 | Research |
| Runtime | Lokalny `Agent.prompt`, `tools: []`, diff w prompcie | Jednorazowe wywołanie ocenia przekazany diff | Research |
| Model | Eval trzech nazw, próg 2 z 3 fixture’ów, remis: `composer-2.5`, potem `grok-4.7`, potem `claude-sonnet-5-5` | Wynik testu wybiera model joba | Plan |
| Etykiety | Tworzone, gdy brak: passed `0e8a16`, failed `d73a4a`, review `fbca04` | „Zielona” i „czerwona” bez hexu w wymaganiach | Plan |
| Eval | Lokalnie, Node `>= 22.22`, poza Actions | Promptfoo nie wejdzie na Node `22.14` joba ani do `ci.yml` | Plan |

## Scope

**In scope:** composite action, testy progu, trzy fixture’y promptfoo, wybór modelu, workflow z uprawnieniami, concurrency i diffem trzy-kropkowym.

**Out of scope:** edycja `ci.yml`, `pull_request_target`, branch protection, czerwony job za werdykt `fail`, jeden aktualizowany komentarz, OpenRouter i `llm-rubric`, pakiet SDK w aplikacji, promptfoo w CI.

## Architecture / Approach

Workflow liczy `git diff origin/<base>...HEAD` na sha głowy PR i woła composite action. Action składa prompt z `prompt.txt`, raz woła lokalnego agenta i zapisuje komentarz oraz etykiety. Ten sam `prompt.txt` i ten sam parser obsługują eval. `REVIEW_MODEL_ID` jest pusty do końca fazy 2.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Akcja recenzji | Parser, próg, komentarz, etykiety, `Agent.prompt` z pustym modelem | Pin SDK `1.0.40` rozmija się z kontem |
| 2. Dobór modelu | Trzy diffa × trzy modele i zapis zwycięzcy | Nazwa modelu nie występuje w `Cursor.models.list()` |
| 3. Cienki workflow | Wyzwalacz, fork, diff, sekret | Sekretu jeszcze nie ma w repozytorium |

**Prerequisites:** konto Cursor z kluczem `CURSOR_API_KEY` i z trzema nazwanymi modelami; lokalnie Node `>= 22.22` tylko do promptfoo; Node `22.14` zostaje dla aplikacji i joba.
**Estimated effort:** około 2–3 sesji na 3 fazy.

## Open Risks & Assumptions

- Zachowanie runtime `Agent.prompt` jest wzięte z typów `1.0.40` i ze skillu SDK, bez odpalonego agenta w researchu.
- Nazwy `grok-4.7` i `claude-sonnet-5-5` mogą na koncie nazywać się inaczej. Wieloznaczna lista przerywa eval.
- PR z tego samego repozytorium może zmienić plik akcji i wykonać go z sekretem. To model zaufanego współpracownika na `pull_request`.
- Przebieg ubity przez `cancel-in-progress` może zdążyć dopisać komentarz.

## Success Criteria (Summary)

- Na PR z tego repozytorium widać nowy komentarz na push i jedną etykietę wyniku, a job recenzji jest zielony.
- Awaria przebiegu jest czerwona i nie zostawia `ai-cr:passed` ani `ai-cr:failed`.
- Fork nie woła agenta. `ci` i `smoke` dalej są jedyną bramką jakości deterministycznej.
