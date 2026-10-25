## Ogólna koncepcja

Osobny workflow GitHub Actions uruchamia przegląd kodu, gdy powstaje albo aktualizuje się pull request do gałęzi `master` (zdarzenia `opened`, `synchronize`, `reopened`). Ten sam workflow startuje ponownie na żądanie, gdy na pull requeście pojawi się etykieta `ai-cr:review`.

Workflow zostaje cienki: wyzwalacz, uprawnienia i przekazanie danych wejściowych. Sam przegląd jest composite action, żeby plik workflow dało się przeczytać bez wchodzenia w wywołanie agenta.

Composite action woła agenta przez pakiet `@cursor/sdk` (TypeScript). Wywołanie jest jednorazowe: agent dostaje parametry wejścia, zwraca ocenę i kończy pracę.

## Parametry wejścia

- **Tytuł pull requesta** — tytuł z zdarzenia GitHub (`pull_request.title`).
- **Diff z gita** — różnica zmian pull requesta względem gałęzi bazowej (`git diff origin/<base>...HEAD`), przekazana agentowi jako plik.

## Kryteria oceny

Agent ocenia diff. Lint, `astro check`, testy, build oraz smoke, integracja i e2e blokują pull request osobno. Każde kryterium dostaje ocenę od 1 (najgorzej) do 10 (najlepiej).

1. **Granica MG i gracza.** Strony MG pod `/dashboard` i `/sessions` są na `PROTECTED_ROUTES`. `/api/**` nie jest na tej liście: każdy endpoint MG sam sprawdza `locals.user` i oddaje 401. Wejście gracza (`/play`, `/api/play/**`) zostaje publiczne i opiera się na kodzie sesji oraz `claim_token`.
   - **1:** nowa powierzchnia MG bez sprawdzenia użytkownika albo endpoint gracza, który wymaga sesji Supabase.
   - **10:** każda nowa strona MG jest za prefiksem albo jawnym sprawdzeniem, każde nowe API MG powtarza 401, a trasy gracza nie ciągną ciasteczka MG.

2. **Izolacja stołu.** Nowa albo zmieniona ścieżka odczytu i zapisu trzyma reguły stołu. Agent ocenia skutek, nie kształt zapytania ani polityki.
   - Drugi MG nie czyta ani nie zmienia cudzej sesji; z zewnątrz wygląda to jak brak sesji, nie jak odmowa uprawnień.
   - Osoba bez ważnego kodu nie widzi planszy.
   - Gracz poznaje etykietę nagrody dopiero po zajęciu pola, MG widzi ją od początku.
   - Pole należy do pierwszego gracza, który je zajął; kolejne kliknięcie go nie przenosi.
   - Aplikacja nie zapisuje katalogu haseł i nagród.
   - **1:** diff pozwala zobaczyć cudzą sesję, zająć zajęte pole, pokazać graczowi nagrodę przed czasem albo dopisać wiersz do katalogu.
   - **10:** każda nowa ścieżka zachowuje te skutki. Polityka, funkcja SQL albo odczyt w serwisie są obojętne.

3. **Kontrakt API i status błędu.** Endpoint ma `export const prerender = false`, metodę wielkimi literami i walidację wejścia przez zod. Znany błąd domenowy mapuje się na status i polski komunikat. Nieoczekiwany wyjątek idzie przez `reportError`. Strona SSR, która rysuje oznaczony błąd ładowania danych, ustawia status inny niż 2xx.
   - **1:** błąd połknięty jako HTTP 200, wejście bez schematu albo brak `prerender = false`.
   - **10:** każdy nowy handler ma schemat, mapę błędów i raportowanie; twarda porażka odczytu nie wygląda jak sukces.

4. **Kontrakt UI.** Widok używa klas ról (`bg-background`, `text-destructive`, …) i `cn()`. Bez heksów, klas palety i wartości arbitralnych. Astro zostaje przy układzie, React tylko tam, gdzie jest interakcja, bez dyrektywy `"use client"`. Przycisk ma `cursor-pointer`, a submit formularza nawigacji pokazuje loader. Jeśli czyszczony widok dostaje nowe stany, plik wchodzi do `SCOPED_FILES` w `scripts/check-ui-literals.mjs`.
   - **1:** nowy ekran z własną paletą, sklejonymi klasami albo przyciskiem bez wskaźnika.
   - **10:** piksele idą z tokenów, a interakcja jest wyspą Reacta w miejscu, które już tak działa.

5. **Miejsce kodu i sekrety.** Typy w `src/types.ts`, logika w `src/lib/` lub `src/lib/services/`, schematy w `src/lib/schemas/`, hooki w `src/components/hooks/`. Sekrety zostają w `.env` / `.dev.vars`, nie w diffie. Nazwa workera `rpg-bingo` i `session: false` bez zmian.
   - **1:** token, hasło albo `SUPABASE_KEY` w commicie, albo logika planszy wlana w komponent strony.
   - **10:** nowy kod leży obok istniejącego rodzeństwa i diff nie dotyka sekretów ani tożsamości workera.

6. **Test zachowania na właściwej warstwie.** Czysta reguła dostaje test jednostkowy. Nowa lub zmieniona trasa HTTP, odmowa niezalogowanemu albo reguła stołu — test integracyjny. Playwright tylko wtedy, gdy bez przeglądarki nie da się tego zobaczyć. Test sprawdza skutek dla gracza albo MG, nie implementację.
   - **1:** zmiana joinu, claimu, izolacji stołu albo auth bez żadnego testu, albo test, który sprawdza, czy w pliku istnieje dane wywołanie metody albo konkretny warunek w zapytaniu.
   - **10:** test leży w tym samym diffie, na najniższej warstwie, która tę regułę naprawdę wykonuje, i pada, gdy skutek dla gracza albo MG jest zły.

Werdykt zbiorczy to `pass` albo `fail`. `fail`, gdy którekolwiek kryterium ma 4 albo mniej. `pass` tylko wtedy, gdy każde kryterium ma co najmniej 7. Ocena 5 lub 6 na dowolnym kryterium też daje `fail`.

## Oczekiwany rezultat

Po zakończeniu przeglądu:

- **Komentarz na pull requeście** ze skrótem oceny i werdyktem.
- **Jedna etykieta wyniku**, zgodna z werdyktem:
  - `ai-cr:passed` (zielona) przy `pass`
  - `ai-cr:failed` (czerwona) przy `fail`

Nowy przebieg zostawia tylko etykietę z bieżącego werdyktu i zdejmuje etykietę wyzwalającą `ai-cr:review`.
