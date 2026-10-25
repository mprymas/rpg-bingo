# Opportunity Map

## Context

- **Project / context**: Zespół budujący wewnętrznie. Trzy tarcia: kopiowanie skilli i reguł AI między repozytoriami, niewidoczne blokady i zbyt długi czas w statusie na tablicy, ręczne zbieranie tematów na podsumowanie dnia z tablicy, gita, maili i Teams. To nie jest funkcja produktu RPG Bingo.
- **Data constraint**: Mock / lokalnie / tylko odczyt / dane niesensytywne. Żywa poczta, Teams i tablica firmowa zostają poza pierwszą wersją, dopóki nie zapadnie osobna decyzja o uprawnieniach i śladzie audytu.
- **Date**: 2026-10-18
- **Decision now**: Nic nie budować. Mapa zostaje, wracamy gdy sygnałów będzie więcej.

## Map

| Signal | Existing / default response | Thin complement | First useful version | Data risk | Direction if valuable |
|---|---|---|---|---|---|
| Skille i reguły AI kopiowane ręcznie między repo; nie wiadomo, który branch jest aktualny | Jedno kanoniczne repo albo katalog i nazwany branch, link w README | Lokalny indeks: nazwa, repo, branch, data commita, duplikaty po nazwie; link do pliku w git | Raport ze lokalnych klonów albo CSV ze ścieżkami | Lokalne, tylko odczyt, niesensytywne | Narzędzie wewnętrzne: rejestr wspólnych artefaktów, dopiero gdy wskaźnik w git nie wystarcza |
| Nie widać blokad (inne zadanie albo czekanie na osobę) ani zadań zbyt długo w statusie, np. test | Tablica: status, czas w statusie, link „blocked by”, zapisane zapytanie. „Czeka na osobę” nie istnieje, dopóki ktoś tego nie zapisze | Raport wieku statusu plus jawne pole „czeka na” | Zapisane zapytanie na tablicy albo mock CSV | Mock / eksport tylko do odczytu | Czekać. Jeśli wejdzie w nawyk, sekcja szkicu dnia, nie osobny produkt |
| Tematy na podsumowanie dnia zbierane ręcznie z tablicy, gita, maili i Teams | Każde źródło ma własną historię dnia; żadne nie składa listy kandydatów. Ocena „co było ważne” zostaje przy człowieku | Lokalny szkic kandydatów z linkiem z powrotem do źródła | Markdown z eksportu tablicy, `git log` i wklejonych tytułów maili oraz wątków jednego dnia | Mock i lokalne eksporty. Żywa poczta i Teams wymagają najpierw uprawnień i audytu | Narzędzie wewnętrzne; harmonogram dopiero gdy lokalny szkic jest używany co dzień |

## Recommended First Candidate

**Szkic podsumowania dnia**

Reads: lokalne pliki jednego dnia — eksport tablicy (zmiany statusu), `git log`, wklejone tematy maili i tytuły wątków Teams. Na start wystarczą mocki o tym samym kształcie.

Returns: krótki markdown z kandydatami do podsumowania, pogrupowanymi według źródła, każdy z linkiem albo ścieżką z powrotem. Lista surowca, nie gotowe podsumowanie.

Does not do: nie wysyła maila, nie pisze na Teams, nie rusza tablicy, nie staje się systemem rekordów, nie czyta żywych skrzynek, nie zgaduje blokad, nie trzyma haseł.

Data risk: mock, lokalnie, tylko odczyt. Dostęp do prawdziwej poczty i Teams wchodzi dopiero po osobnej decyzji o uprawnieniach i audycie.

Direction if it proves valuable: narzędzie wewnętrzne. Odpalenie na harmonogramie dopiero wtedy, gdy lokalny szkic jest używany co dzień. Tablica, git, poczta i Teams zostają źródłami prawdy.

## Why This Candidate

Podsumowanie dnia powtarza się codziennie, a ból polega na tym, że cztery źródła się nie widzą. Da się to sprawdzić na eksportach, bez przejmowania tablicy, gita, poczty ani Teams.

Wiek statusu i powiązanie „zadanie blokuje zadanie” są już na tablicy. Zewnętrzne „czekam na osobę” i tak trzeba wpisać ręcznie. Kopiowanie skilli ma tańszy pierwszy krok w git: jedno miejsce i jeden branch. Rejestr artefaktów ma sens dopiero, gdy ten wskaźnik nie wystarcza, a samo kopiowanie zdarza się rzadziej niż zamknięcie dnia.

## Next Direction If Valuable

Zostajemy przy narzędziu wewnętrznym: lokalny, jednorazowy szkic dnia. Praca na harmonogramie jest późniejszym krokiem i tylko po tym, jak szkic wejdzie w codzienny użytek.

Decyzja z 2026-10-18: na razie nic nie budować. Najtańszy sprawdzian, gdy temat wróci, to krótka rozmowa z ludźmi, którzy to podsumowanie naprawdę piszą — często wiedzą, czemu tarcie istnieje i czy ten obraz jest kompletny.
