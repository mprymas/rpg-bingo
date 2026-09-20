---
project: rpg-bingo
created_at: 2026-09-20
status: deployed
deployed_at: 2026-09-20
production_url: https://rpg-bingo.mprymas.workers.dev
worker_name: rpg-bingo
first_version_id: 85f64962-7ae9-46ee-8275-b57ea9663ead
platform: Cloudflare Workers (Worker + static assets)
source: context/foundation/infrastructure.md (Getting Started, kroki 1-5)
---

# Pierwsze wdrożenie na Cloudflare Workers

## Wynik (2026-09-20)

- Produkcja: `https://rpg-bingo.mprymas.workers.dev` (Worker `rpg-bingo`, wersja `85f64962…`, message `first deploy`).
- Sekrety `SUPABASE_URL`, `SUPABASE_KEY` w Workers Secrets (`wrangler secret bulk .env`). Bindingi: `ASSETS`, `IMAGES`; brak KV `SESSION`.
- Smoke przeciw produkcji: 6/8 PASS. Dwa FAIL (`signup creates account`, `dashboard renders for signed-in user`) wynikają z tego, że Supabase Cloud odrzuca adresy `@example.com` (`Email address is invalid`) — lokalny Supabase je akceptuje. Kroki `home renders` (200), `dashboard redirects` (302), `signin rejects wrong password` (Supabase odpowiada `Invalid login credentials`) dowodzą, że Worker, middleware i połączenie z Supabase działają.
- `cpuTime` z `wrangler tail`: rozgrzane żądania `/` 1–2 ms, `/dashboard` 1 ms, `/auth/signin` 4 ms, `/auth/signup` 5 ms, `/api/auth/*` 2–6 ms. Pierwsze trafienie w daną trasę (ładowanie chunka + inicjalizacja React SSR) 12–19 ms; wszystkie `outcome=ok`, brak 1102. Próg ostrzegawczy p95 > 7 ms dotyczy tylko zimnych tras — obserwować po dodaniu planszy.
- GitHub secrets: `SUPABASE_URL`, `SUPABASE_KEY`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`. Job `deploy` w `ci.yml` aktywny (push na `master`, po `ci` + `smoke`).

### Odstępstwa od planu

- `session: false` to top-level opcja Astro (`defineConfig({ session: false })`), nie opcja adaptera — `cloudflare({ session: false })` z infrastructure.md jest ignorowane (adapter v14 czyta `config.session`). Poprawka zastosowana; build nie loguje już `Enabling sessions with Cloudflare KV`.
- Konto nie miało zarejestrowanej subdomeny `workers.dev`; wrangler v4 nie ma komendy do jej rejestracji, a w trybie nieinteraktywnym odpowiada „no”. Rejestracja (`mprymas`) i pierwszy `wrangler deploy` wykonane interaktywnie przez człowieka.
- `wrangler check startup` zapisuje `worker-startup.cpuprofile` w katalogu repo — usunięty, nie commitować.
- Smoke `scripts/smoke.mjs` nie nadaje się do weryfikacji produkcji na Supabase Cloud (domena `example.com`, brak potwierdzenia e-mail). Do rozważenia: osobny tryb „read-only” (tylko `/`, `/dashboard` redirect) dla produkcji.

Pierwszy deploy RPG Bingo na Cloudflare Workers zgodnie z „Getting Started” w `context/foundation/infrastructure.md`: poprawki konfiguracji, dry-run, sekrety, ręczny deploy + weryfikacja, następnie auto-deploy z GitHub Actions.

## Stan wyjściowy (2026-09-20)

- `wrangler` zalogowany (OAuth, konto `9c231ea1891a209fbb233161e121862d`), `gh` zalogowany jako `mprymas`.
- Remote `https://github.com/mprymas/rpg-bingo.git`, gałąź `master`, jeden commit `bootstrap`.
- Brak GitHub secrets w repo — obecny job `ci` nie zbuduje się bez `SUPABASE_URL`/`SUPABASE_KEY`.
- `.env` istnieje i wskazuje na produkcyjny projekt Supabase Cloud (`ecatwonofbmztxxgmeqb`); `.dev.vars` nie istnieje.
- `wrangler.jsonc` ma nadal `name: "10x-astro-starter"`, `astro.config.mjs` ma `cloudflare()` bez `session: false`.

## Decyzje

- Produkcyjny projekt Supabase: ten z lokalnego `.env` (Supabase Cloud, `ecatwonofbmztxxgmeqb`).
- Auto-deploy z CI: tak — job `deploy` w `ci.yml` z `cloudflare/wrangler-action@v4`; GitHub secrets ustawiane przez `gh secret set`, token Cloudflare dostarcza człowiek.
- Krok 6 z „Getting Started” (Cron anty-pauza Supabase) poza zakresem tego wdrożenia.

## 1. Poprawki konfiguracji przed deployem

- `wrangler.jsonc`: `"name": "10x-astro-starter"` → `"name": "rpg-bingo"` (zmiana później = nowy Worker i utrata historii wersji). `compatibility_date: "2026-05-08"` i `nodejs_compat` bez zmian.
- `astro.config.mjs`: dodać top-level `session: false` (adapter nie provisionuje KV `SESSION`; projekt nie używa Astro Sessions). Uwaga: nie `cloudflare({ session: false })` — patrz „Odstępstwa od planu”.
- Skopiować `.env` do `.dev.vars` (gitignored) — `astro dev` czyta ten plik na workerd.

## 2. Weryfikacja bundle bez deployu (bez nadzoru)

```
npm run build
npx wrangler deploy --dry-run --outdir $env:TEMP\rpg-bingo-bundle
npx wrangler check startup
```

Dry run wychwyci błędy bundlowania i limit 1 s startu.

## 3. Sekrety produkcyjne (wymaga potwierdzenia — tworzy Workera)

`npx wrangler secret bulk .env` — wrangler zapyta o utworzenie Workera `rpg-bingo`; wgrywa `SUPABASE_URL` i `SUPABASE_KEY` z pliku bez przepisywania wartości ręcznie. Wartości nie trafiają do logów ani do repo.

## 4. Pierwszy deploy i weryfikacja

- `npm run build && npx wrangler deploy --message "first deploy"` → `https://rpg-bingo.<account>.workers.dev`.
- W tle `npx wrangler tail --format pretty`, a równolegle `BASE_URL=<url> npm run smoke`.
- Uwaga: `scripts/smoke.mjs` rejestruje konto `smoke-<ts>@example.com` i oczekuje udanego logowania od razu po signup. Lokalne `supabase/config.toml` ma `enable_confirmations = false`, ale w Supabase Cloud potwierdzanie e-maila jest domyślnie włączone — krok „signin accepts correct password” może wtedy nie przejść. To nie jest błąd deployu; kroki `home renders`, `dashboard redirects`, `signup` i `signout` wystarczą jako dowód, że Worker + Supabase działają.
- Odnotować `cpuTime` z `tail` dla logowania i strony planszy (próg ostrzegawczy p95 > 7 ms → rozważyć Workers Paid przed pierwszą sesją).

## 5. Auto-deploy z CI

Rozszerzyć `.github/workflows/ci.yml` o job:

```yaml
deploy:
  needs: [ci, smoke]
  if: github.event_name == 'push' && github.ref == 'refs/heads/master'
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: npm }
    - run: npm ci
    - run: npm run build
      env:
        SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
        SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
    - uses: cloudflare/wrangler-action@v4
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
        command: deploy
```

GitHub secrets przez `gh secret set`:

- `SUPABASE_URL`, `SUPABASE_KEY` — z `.env` (bez nich nawet obecny job `ci` nie buduje).
- `CLOUDFLARE_ACCOUNT_ID` = `9c231ea1891a209fbb233161e121862d` (z `wrangler whoami`).
- `CLOUDFLARE_API_TOKEN` — tworzony ręcznie w dashboardzie Cloudflare (My Profile → API Tokens → szablon „Edit Cloudflare Workers”, zakres: to jedno konto). Ustawiany przez `gh secret set CLOUDFLARE_API_TOKEN` bez zapisywania wartości w repo/logach.

Nie włączamy Workers Builds (git integration) — jeden mechanizm deployu, brak podwójnego deployu z `master`.

## 6. Commit i push

- Aktualizacja `CLAUDE.md` (sekcja Deploy/CI: nazwa Workera, `wrangler secret`, auto-deploy na `master`) i `README.md`, jeśli opisuje deploy.
- Commit obejmie także `context/foundation/infrastructure.md`, zmodyfikowany `tech-stack.md` i ten plan. Push na `master` uruchamia pełny pipeline: lint+build → smoke → deploy. Wynik sprawdzany przez `gh run watch` / `gh run view`.

## Lista zadań

- [x] Zmienić `name` na `rpg-bingo` w `wrangler.jsonc`, `session: false` w `astro.config.mjs`, utworzyć `.dev.vars` z `.env`
- [x] `npm run build` + `wrangler deploy --dry-run` + `wrangler check startup`
- [x] `wrangler secret bulk .env` (tworzy Workera `rpg-bingo`)
- [x] `wrangler deploy`, smoke przeciw `workers.dev` URL, odczyt `cpuTime` z `wrangler tail`
- [x] Dodać job `deploy` do `ci.yml` (`wrangler-action@v4`, `needs: [ci, smoke]`, tylko push na `master`)
- [x] `gh secret set`: `SUPABASE_URL`, `SUPABASE_KEY`, `CLOUDFLARE_ACCOUNT_ID`; poprosić o `CLOUDFLARE_API_TOKEN` i ustawić
- [x] Zaktualizować `CLAUDE.md`/`README.md` (deploy), commit + push na `master`, zweryfikować przebieg pipeline

## Poza zakresem (do zrobienia później)

- Cron Trigger anty-pauza Supabase Free + endpoint `/api/health`.
- Cloudflare Access dla preview URLs.
- Osobny projekt Supabase dla preview.
