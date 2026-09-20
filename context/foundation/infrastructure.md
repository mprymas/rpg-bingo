---
project: rpg-bingo
researched_at: 2026-09-20
recommended_platform: Cloudflare Workers (static assets)
runner_up: Vercel
context_type: mvp
tech_stack:
  language: TypeScript
  framework: Astro 7.3 (SSR, output "server") + React 19 islands + Tailwind 4
  runtime: Cloudflare workerd via @astrojs/cloudflare ^14.3 + wrangler ^4.131
---

## Recommendation

**Deploy on Cloudflare Workers (Worker + static assets).**

Cloudflare Workers jako jedyna z sześciu badanych platform zdobyła 5/5 Pass w kryteriach agent-friendly i jako jedyna daje realne $0/mies. bez klauzuli niekomercyjnej i bez ograniczeń regionu na darmowym planie (Workers Free: 100 000 req/dzień, static assets bez limitu i bez opłat za egress). Decyzję przesądziły trzy fakty z wywiadu i stacku: aplikacja jest czysto request/response z pollingiem ≤ 10 s (brak potrzeby trwałych procesów), priorytetem jest minimalny koszt, a repo jest już skonfigurowane pod ten cel — `@astrojs/cloudflare` 14, `wrangler.jsonc` w trybie Workers + assets, `nodejs_compat`, `observability`. Każda inna platforma wymagałaby wymiany adaptera (`@astrojs/vercel`, `@astrojs/netlify` lub `@astrojs/node` + Dockerfile) w oknie 3 tygodni do deadline'u 2026-11-04.

Korekta względem `tech-stack.md`: hint `deployment_target: cloudflare-pages` jest nieaktualny. Cloudflare od 2025 kieruje nowe projekty na Workers („Start new projects with Workers”), a `@astrojs/cloudflare` usunął wsparcie Pages w v13. Celem jest **Workers**, nie Pages.

## Platform Comparison

Filtry twarde: brak (Q1 = brak trwałych połączeń; stack TS/JS obsługiwany wszędzie). Wagi miękkie z wywiadu: minimalny koszt (Q2), brak preferowanej platformy (Q3), jeden region EU (Q4), Supabase jako zewnętrzna baza + auth (Q5).

| Platforma | CLI-first | Managed/Serverless | Agent-readable docs | Stable deploy API | MCP / Integration | Total | Koszt @ 10k–100k req/mies. |
|---|---|---|---|---|---|---|---|
| Cloudflare Workers | Pass | Pass | Pass | Pass | Pass | 5 Pass | $0 (Free) / $5 (Paid) |
| Vercel | Pass | Pass | Pass | Pass | Partial | 4 Pass, 1 Partial | $0 Hobby (niekomercyjnie) / $20 Pro |
| Netlify | Partial | Pass | Pass | Pass | Pass | 4 Pass, 1 Partial | $0 Free (limit kredytów) / $20 Pro |
| Railway | Partial | Pass | Pass | Pass | Pass | 4 Pass, 1 Partial | ~$5–6 Hobby |
| Render | Partial | Pass | Pass | Pass | Pass | 4 Pass, 1 Partial | $0 Free (spin-down) / $7 Starter |
| Fly.io | Pass | Partial | Partial | Pass | Partial | 2 Pass, 3 Partial | ~$1–6, brak free tier |

**Cloudflare Workers.** `wrangler` pokrywa cały cykl: `deploy`, `versions upload/deploy`, `rollback`, `tail`, `secret put` — bez dashboardu. Docs jako Markdown (`/index.md`, `llms.txt`, `llms-full.txt`) i źródło na GitHub (`cloudflare/cloudflare-docs`). Kilka zdalnych serwerów MCP w GA (`mcp.cloudflare.com/mcp`, `docs.`, `bindings.`, `builds.`, `observability.`), `cloudflare/wrangler-action@v4`. Workers Free: 100k req/dzień, 10 ms CPU/req, 128 MB; Paid $5/mies. z 10 M req + 30 M CPU-ms. Static assets darmowe, brak egress. Beta: Secrets Store, `cacheCloudflare()` w adapterze (private beta — nie używać).

**Vercel.** `@astrojs/vercel` 11.x wspiera Astro 7 na Node 24 + Fluid compute (GA). CLI kompletne (`vercel --prod`, `vercel rollback`, `vercel logs`, `vercel env`). Docs markdown + `llms.txt`, ale źródło nie na GitHub. Vercel MCP w **public beta**. Hobby $0 z twardą klauzulą wyłącznie niekomercyjnego użycia (RPG Bingo dla własnego stołu mieści się, ale to ryzyko interpretacyjne) i jednym regionem funkcji (można ustawić `fra1`). Pro $20/mies. Własna strona Vercel o Astro jest nieaktualna (usunięty import `/serverless`, `output: 'hybrid'`) — trzeba iść za docs Astro.

**Netlify.** `@astrojs/netlify` 8.2.x dla Astro 7, SSR w Netlify Functions (Node 22 z `.nvmrc`). Free $0 / 300 kredytów mies., komercyjnie dozwolone, ale **deploy produkcyjny kosztuje 15 kredytów** (~18 deployów/mies. zanim strona zostanie spauzowana) i **wybór regionu funkcji tylko na Pro** — na Free SSR działa w Ohio, każdy round-trip do Supabase w EU przez Atlantyk. Rollback tylko przez `netlify api restoreSiteDeploy`, brak dedykowanej komendy. MCP GA. Oficjalna GitHub Action nieutrzymywana.

**Railway.** Kontenery przez Railpack (Nixpacks deprecated), wymaga `@astrojs/node` + `HOST=0.0.0.0`. Region Amsterdam dostępny na wszystkich planach. Free plan ($1 kredyt/mies.) nie utrzyma serwisu always-on; Hobby $5/mies. Rollback do dowolnego deployu **tylko z dashboardu** (CLI ma `redeploy`/`restart`). Docs `.md` + `llms.txt` + GitHub. MCP GA. PR environments GA (płatne compute).

**Render.** Web Service z `@astrojs/node`, Frankfurt, Node 22 z `.nvmrc`. Free $0, ale spin-down po 15 min bezczynności i ~1 min zimny start — dla aplikacji przy stole to pierwsze wejście w wieczór gry trwa minutę. Starter $7/mies. always-on. CLI GA (`deploys create`, `logs --tail`), ale **brak rollback i edycji env vars w CLI** — REST API lub dashboard. Pełne Preview Environments tylko Pro $25. MCP GA, `llms.txt` GA.

**Fly.io.** Firecracker VM z własnym Dockerfile (`fly launch` generuje go dla Astro + `@astrojs/node`). Brak free tier — 7-dniowy trial, potem karta i Pay-As-You-Go (~$2–3.50/mies. za 256–512 MB w `ams`, `waw` **deprecated**). Domyślnie tworzy 2 maszyny (`--ha=false`). Rollback = `fly deploy --image` poprzedniego release'u. Docs markdown na GitHub, brak `llms.txt`. `fly mcp` **experimental**. Najwięcej powierzchni operacyjnej dla solo dewelopera.

### Shortlisted Platforms

#### 1. Cloudflare Workers (Recommended)

Jedyna platforma z 5/5 Pass. Zero kosztu przy skali PRD (kilku graczy, polling co 10 s: ~17k requestów na 8-godzinną sesję vs 100k/dzień limitu). Repo już zbudowane pod ten cel — brak pracy migracyjnej. `astro dev` i `astro preview` uruchamiają się w workerd (adapter v14), więc lokalny runtime jest wierny produkcji, a CI smoke (`npm run preview` + `scripts/smoke.mjs`) testuje ten sam runtime. Pełne CLI, Markdown docs, MCP GA, `wrangler-action@v4`.

#### 2. Vercel

Drugie miejsce dzięki kompletnemu CLI (w tym prawdziwemu `vercel rollback`) i dojrzałemu adapterowi dla Astro 7. Luka: MCP w beta, $0 tylko pod klauzulą niekomercyjną (albo $20/mies.), wymaga wymiany adaptera i zmiany modelu sekretów (`vercel env` zamiast `wrangler secret`). Sensowny plan B, jeśli limit 10 ms CPU na Workers Free okaże się blokujący i użytkownik nie chce płacić $5 Cloudflare Paid.

#### 3. Netlify

Trzecie miejsce: $0 z dozwolonym użyciem komercyjnym i MCP GA, ale dwie kosztowne wady dla tego projektu — funkcje SSR w US na darmowym planie przy Supabase w EU oraz limit ~18 deployów produkcyjnych miesięcznie (15 kredytów/deploy z 300). Dla solo dewelopera w trybie „auto-deploy on merge” ten limit jest realny. Rollback tylko przez generyczne `netlify api`.

## Anti-Bias Cross-Check: Cloudflare Workers

### Devil's Advocate — Weaknesses

1. **Limit 10 ms CPU/request na Workers Free.** Docs Cloudflare: SSR „zwykle zużywa 10–20 ms”. Render planszy 5×5 w Astro plus odświeżenie sesji Supabase (weryfikacja JWT w `@supabase/ssr`) w jednym requeście może sporadycznie przekroczyć limit → Error 1102 widoczny graczowi. Realny koszt może wynieść $5/mies. (Paid: 30 s CPU/req).
2. **Niezgodności Node w workerd wychodzą dopiero w runtime.** `@supabase/ssr` ma znany błąd „Dynamic require of stream” bez `nodejs_compat`. Repo ma flagę, ale każda nowa zależność (hashowanie, generowanie kodu sesji) może użyć API, którego workerd nie ma. Bundler nie ostrzeże.
3. **`wrangler secret put` natychmiast tworzy i deployuje nową wersję.** Rotacja klucza Supabase to de facto deploy produkcyjny z pominięciem CI. Sekrety w `astro:env` są `optional: true`, więc brak sekretu przechodzi przez build i wychodzi jako 500 na produkcji.
4. **Preview URLs są publiczne i bez logów.** Każdy `wrangler versions upload` tworzy publiczny URL `<version>-<worker>.<account>.workers.dev`; `wrangler tail` nie działa na preview. Ochrona wymaga włączenia Zero Trust i polityki Cloudflare Access.
5. **Adapter cicho provisionuje KV namespace `SESSION`**, jeśli nie ustawisz `session: false` — nieoczekiwany zasób i zależność, z której projekt nie korzysta (sesje MG są w cookies Supabase; gracz ma tożsamość tylko w obrębie sesji gry).

### Pre-Mortem — How This Could Fail

Zespół (jedna osoba) wdrożył RPG Bingo na Workers Free w październiku 2026, dwa tygodnie przed deadline'em. Pierwsza sesja przy stole poszła gładko. Problemy zaczęły się na trzeciej: MG dopisał 40 własnych haseł, plansza renderowała się dłużej, a request ze świeżym cookie Supabase przekraczał 10 ms CPU — co kilkanaste kliknięcie kończyło się błędem 1102. Nikt tego nie zauważył w `astro dev`, bo lokalny workerd nie egzekwuje limitu CPU. Developer dodał bibliotekę do haszowania kodów sesji, która działała lokalnie, ale w produkcji rzuciła brakiem Node API po podniesieniu `compatibility_date` „żeby mieć najnowsze”. Rotacja klucza Supabase przez `wrangler secret put` z lokalnej maszyny wgrała wersję z niedokończonej gałęzi. Rollback przywrócił kod, ale nie migrację bazy — stara wersja nie znała nowej kolumny. Do tego projekt Supabase na Free został spauzowany po tygodniu bez ruchu między sesjami i w dzień gry aplikacja wstawała minutę. Deadline minął z działającym, ale nieufnym stołem.

### Unknown Unknowns

- **`wrangler dev` to legacy dla tego stacku.** Od `@astrojs/cloudflare` v14 (Astro ≥ 7.2) `astro dev` i `astro preview` działają wewnątrz workerd przez Cloudflare Vite plugin. Nie dodawaj `wrangler dev` do skryptów — dubluje runtime i myli agentów. `.dev.vars` jest nadal czytany przez `astro dev`.
- **`nodejs_compat` staje się domyślne od `compatibility_date ≥ 2026-08-04`.** Repo ma `2026-05-08`, flaga jest potrzebna i obecna. Podniesienie daty zmienia zachowania runtime (nie tylko Node compat) — traktuj jak upgrade zależności: bump, `npm run build`, `npm run smoke`, dopiero potem deploy.
- **Rollback nie cofa sekretów ani migracji Supabase.** `wrangler rollback` przywraca poprzednią wersję kodu; schema w Supabase i wartości sekretów zostają. Migracje muszą być kompatybilne wstecz o jedną wersję (expand → migrate → contract).
- **`name` w `wrangler.jsonc` to nadal `10x-astro-starter`.** Pierwszy deploy stworzy Workera `10x-astro-starter` i subdomenę `10x-astro-starter.<account>.workers.dev`; zmiana nazwy później = nowy Worker i utrata historii wersji. Zmień na `rpg-bingo` przed pierwszym deployem.
- **Realny „zimny start” nie jest po stronie Cloudflare, ale Supabase Free** — projekt pauzuje po 7 dniach bez aktywności. Dla aplikacji używanej raz na tydzień–dwa to codzienność, nie edge case. Workers cold start to ~5 ms, ukryty za TLS handshake.
- **Workers Logs na Free: 200k eventów/dzień, retencja 3 dni.** Błąd z sesji w sobotę jest niewidoczny we wtorek wieczorem. Do debugowania sesji trzeba czytać logi w ciągu 72 h albo włączyć Paid (7 dni).
- **CI w repo nie deployuje.** `ci.yml` robi lint + build + smoke, ale hint `ci_default_flow: auto-deploy-on-merge` z `tech-stack.md` wymaga jeszcze wyboru: Workers Builds (git integration, GA, 3000 min/mies. na Free) **albo** krok `cloudflare/wrangler-action@v4` w `ci.yml`. Nie oba — podwójny deploy z tej samej gałęzi.

## Operational Story

- **Preview deploys**: `npx astro build && npx wrangler versions upload --preview-alias pr-<n>` tworzy wersję bez deployu i zwraca publiczny URL `pr-<n>-rpg-bingo.<account>.workers.dev`. Przy Workers Builds z git integration preview URL powstaje automatycznie dla każdej gałęzi nie-produkcyjnej (branch aliasy mniej konfigurowalne niż w Pages). Preview URLs są publiczne — chronić przez Cloudflare Access z zakresem „Previews only” (wymaga włączonego Zero Trust). Preview nie ma `wrangler tail`. Fork PRs w Workers Builds nie mają dostępu do sekretów — smoke na forkach musi lecieć w GitHub Actions na lokalnym Supabase (już tak działa).
- **Secrets**: produkcja — `npx wrangler secret put SUPABASE_URL` / `SUPABASE_KEY` (Workers Secrets, zaszyfrowane, nieodczytywalne po zapisie; `secret list` pokazuje tylko nazwy). Lokalnie — `.dev.vars` (gitignored), czytany przez `astro dev`. CI — GitHub Secrets `SUPABASE_URL`, `SUPABASE_KEY` (do builda) oraz `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (do deployu). Rotacja: `wrangler secret put` z nową wartością → natychmiast nowa wersja; robić z gałęzi `master` w stanie zgodnym z produkcją. Token API z uprawnieniem „Workers Scripts: Edit” ograniczonym do konta, nie Global API Key.
- **Rollback**: `npx wrangler rollback` (do poprzedniej wersji) lub `npx wrangler rollback <VERSION_ID> --message "…"`; lista: `npx wrangler versions list`, status: `npx wrangler deployments status`. Czas przywrócenia: sekundy (propagacja edge). Nie cofa sekretów ani migracji Supabase — migracje w `supabase/migrations/` muszą być kompatybilne wstecz o jedną wersję.
- **Approval**: człowiek zatwierdza — deploy do produkcji (merge do `master` albo ręczne `wrangler deploy`), `wrangler secret put`/`delete`, zmianę `compatibility_date`, zmianę `name` Workera, usunięcie Workera, wszystko w Supabase co dotyka schematu produkcyjnego. Agent może bez nadzoru — `wrangler deploy --dry-run --outdir /tmp/bundle`, `wrangler versions upload` (preview), `wrangler versions list`, `wrangler deployments list/status`, `wrangler tail`, `wrangler check startup`, `wrangler types`.
- **Logs**: runtime — `npx wrangler tail --format pretty` (dodać `--status error` albo `--search <fraza>`); Workers Logs w dashboardzie (Free: 200k eventów/dzień, 3 dni). Pipeline — GitHub Actions: `gh run list`, `gh run view <id> --log`; przy Workers Builds: MCP `builds.mcp.cloudflare.com/mcp`. Obserwowalność read-only przez MCP `observability.mcp.cloudflare.com/mcp`. Docs przez `docs.mcp.cloudflare.com/mcp` lub `https://developers.cloudflare.com/workers/llms-full.txt`.

## Risk Register

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Przekroczenie 10 ms CPU/req na Workers Free → Error 1102 przy renderze planszy z odświeżeniem sesji Supabase | Devil's advocate / Pre-mortem | M | H | Po pierwszym deployu zmierzyć `cpuTime` w Workers Logs dla `/api/*` i strony planszy; jeśli p95 > 7 ms — włączyć Workers Paid ($5/mies.) przed pierwszą prawdziwą sesją. Trzymać odświeżanie planszy jako lekki endpoint JSON, nie pełny SSR. |
| Zależność używająca Node API nieobsługiwanego przez workerd — błąd tylko w runtime | Devil's advocate / Pre-mortem | M | M | Każda nowa zależność przechodzi `npm run build` + `npm run smoke` (preview działa w workerd). `npx wrangler deploy --dry-run --outdir /tmp/bundle` w CI. Nie podnosić `compatibility_date` bez smoke. |
| `wrangler secret put` deployuje niekontrolowaną wersję z lokalnej maszyny | Devil's advocate / Pre-mortem | L | H | Rotować sekrety tylko z czystego `master` po `git pull`; alternatywnie `wrangler versions upload --secrets-file` + `versions deploy`. Sekrety wymagane produkcyjnie sprawdzać na starcie requestu i zwracać czytelny 503. |
| Publiczne preview URLs ujawniają niedokończone funkcje / używają produkcyjnego Supabase | Devil's advocate | M | L | Cloudflare Access „Previews only” po włączeniu Zero Trust (Free do 50 użytkowników). Preview kierować na osobny projekt Supabase (dev) przez `--secrets-file`. |
| Niechciany KV namespace `SESSION` provisionowany przez adapter | Devil's advocate | H | L | Ustawić top-level `session: false` w `defineConfig` w `astro.config.mjs` przed pierwszym deployem — projekt nie używa Astro Sessions. (Adapter v14 czyta `config.session`; `cloudflare({ session: false })` jest ignorowane — zweryfikowano przy pierwszym deployu 2026-09-20.) |
| Rollback kodu bez rollbacku migracji Supabase → stara wersja nie zna schematu | Unknown unknowns / Pre-mortem | M | H | Migracje wstecznie kompatybilne o jedną wersję (dodawanie kolumn nullable, usuwanie dopiero po kolejnym deployu). Nazwa pliku migracji w opisie wersji: `wrangler deploy --message "mig 2026…"`. |
| Worker nazwany `10x-astro-starter` — zmiana nazwy później = nowy Worker | Unknown unknowns | H | M | Zmienić `name` w `wrangler.jsonc` na `rpg-bingo` przed pierwszym `wrangler deploy`. |
| Podwójny deploy z `master` (Workers Builds + `wrangler-action` jednocześnie) | Unknown unknowns | M | M | Wybrać jeden mechanizm. Rekomendacja: `wrangler-action@v4` jako krok w istniejącym `ci.yml` po smoke (`needs: [ci, smoke]`, tylko `push` na `master`) — jeden pipeline, jedna prawda. |
| Supabase Free pauzuje projekt po 7 dniach bezczynności — minuta zimnego startu w dzień gry | Unknown unknowns / Pre-mortem | H | M | Wejść na stronę logowania dzień przed sesją lub dodać Cloudflare Cron Trigger (`[triggers] crons`, GA, darmowy) pingujący lekki endpoint `/api/health` raz dziennie. Alternatywa: Supabase Pro $25/mies. — poza budżetem MVP. |
| Retencja logów 3 dni na Free — błąd z sesji nieodtwarzalny po weekendzie | Unknown unknowns | M | L | Po każdej sesji przy stole w ciągu 48 h: `wrangler tail` nie pomoże wstecz — użyć Workers Logs w dashboardzie lub MCP observability i zapisać istotne wpisy. |
| `nodejs_compat` przez flagę, nie domyślnie (`compatibility_date` 2026-05-08 < 2026-08-04) | Research finding | L | M | Nie usuwać flagi. Bump daty tylko świadomie, jako osobny PR z pełnym smoke. |
| `cacheCloudflare()` w adapterze to private beta | Research finding | L | M | Nie włączać; cache po stronie Cloudflare nie jest potrzebny przy pollingu 10 s i małej skali. |

## Getting Started

Komendy zweryfikowane pod `@astrojs/cloudflare` ^14.3, `wrangler` ^4.131, Astro ^7.3 (stan na 2026-09-20). `wrangler dev` **nie jest potrzebny** — `astro dev` działa w workerd.

1. **Popraw konfigurację przed pierwszym deployem.** W `wrangler.jsonc` zmień `"name": "10x-astro-starter"` na `"name": "rpg-bingo"`. W `astro.config.mjs` dodaj top-level `session: false` do `defineConfig` (nie jako opcję adaptera — adapter v14 czyta `config.session`), żeby adapter nie provisionował KV `SESSION`. Zostaw `compatibility_date: "2026-05-08"` i `nodejs_compat` bez zmian.
2. **Zaloguj wrangler i sprawdź bundle bez deployu.**
   `npx wrangler login` → `npm run build` → `npx wrangler deploy --dry-run --outdir /tmp/rpg-bingo-bundle` → `npx wrangler check startup`. Dry run wychwyci błędy bundlowania i limit 1 s startu.
3. **Wgraj sekrety produkcyjne (interaktywnie, z czystego `master`).**
   `npx wrangler secret put SUPABASE_URL` → `npx wrangler secret put SUPABASE_KEY`. Lokalnie trzymaj te same klucze w `.dev.vars` (gitignored) — czyta je `astro dev`.
4. **Pierwszy deploy i weryfikacja.**
   `npm run build && npx wrangler deploy` → Worker dostępny pod `https://rpg-bingo.<account>.workers.dev`. Uruchom `BASE_URL=https://rpg-bingo.<account>.workers.dev npm run smoke` i w drugim terminalu `npx wrangler tail --format pretty`, żeby zobaczyć czas CPU requestów logowania i planszy. Jeśli `cpuTime` regularnie zbliża się do 10 ms — włącz Workers Paid w dashboardzie przed pierwszą sesją.
5. **Auto-deploy z CI.** W `.github/workflows/ci.yml` dodaj job `deploy` z `needs: [ci, smoke]`, `if: github.event_name == 'push' && github.ref == 'refs/heads/master'`, kroki: checkout, setup-node 22, `npm ci`, `npm run build` (z sekretami Supabase), a potem `cloudflare/wrangler-action@v4` z `apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}`, `accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`, `command: deploy`. Token API tworzony w Cloudflare z szablonu „Edit Cloudflare Workers”. Nie włączaj równolegle Workers Builds dla tego repo.
6. **(Opcjonalnie, przed pierwszą sesją)** Cron Trigger anty-pauza Supabase: w `wrangler.jsonc` `"triggers": { "crons": ["0 9 * * *"] }` i handler `scheduled` pingujący własny lekki endpoint, który wykonuje trywialne zapytanie do Supabase.

## Out of Scope

The following were not evaluated in this research:
- Docker image configuration
- CI/CD pipeline setup (poza wskazaniem mechanizmu deployu w Getting Started)
- Production-scale architecture (multi-region, HA, DR)
- Hosting Supabase (pozostaje na Supabase Cloud jako zewnętrzny dostawca zgodnie z odpowiedzią Q5)
