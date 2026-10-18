---
artifact: domain-glossary
created: 2026-10-18
source: context/domain/01-domain-distillation.md
---

# Glossary: RPG Bingo

Używaj tych słów w kodzie, testach, commitach i rozmowie. Kolumna „name in code” to nazwa domenowa w camelCase, w liczbie pojedynczej, gdy chodzi o jeden byt. Nazwa tabeli albo kolumny (snake_case, liczba mnoga) nie jest tą nazwą. Typy w TypeScript zostają PascalCase (`SessionPlayer`), pola i zmienne camelCase (`sessionPlayer`).

## Stół

| term | means | name in code | don't call it |
| --- | --- | --- | --- |
| Mistrz Gry | Osoba z kontem, która tworzy sesję i prowadzi stół. | `gameMaster` | `gm_id`, `gmId` (to tylko id konta MG na sesji), admin, właściciel instancji |
| Gracz | Jedna osoba przy planszy, bez konta, rozpoznawana nickiem w tej sesji. | `sessionPlayer` | `session_players`, user, konto, MG |
| sesja | Jedna gra: kod, prowadzący, status, jedna plansza. | `session` | `sessions`, gra, mecz |
| plansza | Siatka N×N należąca do jednej sesji. | `board` | `board_cells`, `sessions.size`, osobna tabela `boards` |
| pole | Jedna komórka planszy. | `boardCell` | `board_cells`, kafelek, seat, tile |
| hasło | Tekst wyzwania na polu, z katalogu albo wpisany przez MG. | `phrase` | `phrases`, password, zadanie, bonus |
| nagroda | Skutek reguły (pole, próg albo linia), z katalogu. | `reward` | `rewards`, bonus, inspiracja jako typ (to slug `inspiration`) |
| kod sesji | Sześć znaków, którymi stół wchodzi na planszę. | `sessionCode` | samo `code` (to też kod błędu), id sesji, token |
| wolne | Pole bez zajmującego. | `free` | `claimed_by_player_id`, `open` |
| zajęte | Pole ma jednego zajmującego. | `claimed` | `owned`, `taken`, `claimed_by_player_id` jako nazwa stanu |
| oznaczenie | Gracz zajmuje wolne pole. | `claim` | click, score, check-in |
| mystery-until-claim | Gracz widzi, że pole ma nagrodę, a rodzaj dopiero po zajęciu. MG widzi rodzaj od razu. | `hasReward` | ukryta nagroda, spoiler |
| nagroda za konkretne pole | Nagroda przypięta do komórki, dla tego, kto ją zajął. | `fieldReward` | `reward_id`, `field_rewards`, próg, linia, nagroda drużynowa |
| nagroda za liczbę pól | Każdy gracz, który dojdzie do N swoich pól, dostaje wylosowaną nagrodę progu. | `threshold` | `threshold_count`, level, score, nagroda drużynowa |
| nagroda za wiersz/kolumnę | Jedna nagroda za pełny wiersz albo pełną kolumnę; bierze ją ten, kto zajął ostatnie pole. | `line` | `board_lines`, bingo, przekątna, układ drużynowy |
| nick | Imię przy stole, 1–24 znaki, może się powtarzać. | `nick` | username, login, nazwa gracza |
| kolor | Numer 1–8 z kolejności dołączenia, ze zwijaniem. | `color` | token 1–16, losowy kolor |
| własne hasła | Hasła dopisane przez MG do tej sesji; zaznaczone wchodzą na planszę na pewno. | `customPhrase` | `customPhrases` jako nazwa jednego hasła, katalog, fraza systemowa |
| baza predefiniowanych haseł | Katalog haseł dostarczony z góry, tylko do odczytu dla MG. | `phraseCatalog` | `phrases`, biblioteka społeczności, kategoria |
| cofnięcie | MG zwalnia pole na aktywnej sesji; slot nagrody zostaje. | `undo` | rollback sesji, unclaim gracza |
| regeneracja | Nowa sesja z nowym kodem; stara wskazuje następcę i przechodzi w zamkniętą. | `regenerateBoard` | `replaceSessionId` (to id źródła, nie operacja), edycja planszy w miejscu |
| successor | Sesja, która zastąpiła zamkniętą. Jej kod to `successorCode`. | `successor` | `replaced_by_session_id`, parent, fork |
| active | Sesja, do której można dołączyć i zajmować pola. | `active` | open, live, running |
| closed | Sesja tylko do odczytu. | `closed` | deleted, archived, finished jako trzeci status |
| usunięcie sesji | MG kasuje sesję dowolnego statusu po potwierdzeniu. | `deleteSession` | `delete_session`, close, archiwizacja |
| kod QR | Obraz adresu dołączenia do tej sesji. | `sessionJoinQr` | kod sesji (to sześć znaków) |
| dołączenie | Wejście kodem i nickiem, bez konta. | `join` | signup, login, claim |
| nagroda drużynowa | Nagroda dla drużyny za układ, którego definicja jest otwarta. W kodzie jej jeszcze nie ma. | `teamReward` | `line`, próg, `side-quest` |
| administrator systemu | Rola, która miała utrzymywać katalog. W aplikacji jej nie ma; katalog jest seedem. | `catalogAdmin` | MG, `gameMaster`, `gm_id` |
| własne nagrody MG | Nagrody wymyślone przez MG, poza katalogiem. W kodzie ich jeszcze nie ma. | `customReward` | własne hasła, `customPhrase` |

## Hasło konta (B-01)

| term | means | name in code | don't call it |
| --- | --- | --- | --- |
| hasło konta | Sekret logowania MG. | `password` | phrase, hasło na planszy, kod sesji |

## Wynik zajęcia (B-02)

| term | means | name in code | don't call it |
| --- | --- | --- | --- |
| status zajęcia | Wynik jednego claimu: pole wzięte albo już zajęte. | `claimStatus` (`claimed` albo `conflict`) | `session.status`, `active`, `closed` |

## Układ drużynowy (B-03)

| term | means | name in code | don't call it |
| --- | --- | --- | --- |
| układ drużynowy | Otwarta definicja nagrody dla całej drużyny (linia, przekątna albo cała plansza). | `teamPattern` | `line`, próg, wiersz/kolumna |

## Zadanie poboczne (B-05)

| term | means | name in code | don't call it |
| --- | --- | --- | --- |
| zadanie poboczne | Pozycja katalogu nagród, nie czynność z hasła. | `sideQuest` | `side-quest`, phrase, zadanie z pola, misja jako typ |
