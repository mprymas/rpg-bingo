-- Catalog seed for hosted F-01 apply (do not db reset).
-- Safe to re-run: phrases skip duplicates; rewards upsert label/description by slug.

INSERT INTO public.phrases (text) VALUES
  ('Wespnij się na wysoki mur'),
  ('Przejdź po linie na dużej wysokości'),
  ('Niepostrzeżenie prześliznij się koło strażników'),
  ('Ukradnij przypasaną sakiewkę'),
  ('Pochwal się swoją wiedzą historyczną'),
  ('Przygotuj przepyszny posiłek'),
  ('Zmów modlitwę do boga'),
  ('Wyciągnij wnioski na podstawie śladów'),
  ('Rozpoznaj magiczne właściwości przedmiotu'),
  ('Przejrzyj czyjeś kłamstwo'),
  ('Uratuj sojusznika za pomocą medycyny'),
  ('Oswój zwierzę'),
  ('Znajdź ukryte przejście'),
  ('Upoluj dzikie zwierzę'),
  ('Wyłgaj się straży'),
  ('Przekonaj kupca do zniżki'),
  ('Zarób złoto za pomocą występu'),
  ('Zastrasz kogoś, by uciekł podczas walki'),
  ('Chybienie krytyczne'),
  ('Trafienie krytyczne'),
  ('Zabij wielu przeciwników jedną akcją'),
  ('Przeskocz nad przepaścią'),
  ('Wpadnij w pułapkę'),
  ('Rozbroj pułapkę bez jej uruchomienia'),
  ('Przebiegnij w walce minimum 100 metrów'),
  ('Otrzymaj podziękowanie od NPC'),
  ('Zaskocz przeciwników'),
  ('Uwiedź NPC'),
  ('Pokonaj przeciwnika w pojedynku 1 na 1'),
  ('Pchnij przeciwnika w niebezpieczeństwo'),
  ('Wypij więcej alkoholu niż ktokolwiek inny'),
  ('Użyj improwizowanej broni')
ON CONFLICT (text) DO NOTHING;

INSERT INTO public.rewards (slug, label, description) VALUES
  (
    'inspiration',
    'Inspiracja',
    'Przyznanie inspiracji dla zdobywcy pola.'
  ),
  (
    'item',
    'Przedmiot',
    'Drobny przedmiot fabularny lub użytkowy.'
  ),
  (
    'side-quest',
    'Zadanie poboczne',
    'Krótki wątek poboczny dla drużyny.'
  ),
  (
    'clue',
    'Wskazówka',
    'MG zdradza jedną użyteczną wskazówkę związaną z bieżącą sytuacją.'
  ),
  (
    'npc-help',
    'Pomoc w walce',
    'Wprowadzenie pomocy do następnej walki za pomocą NPC.'
  ),
  (
    'experience',
    'Doświadczenie',
    'Dodatkowe punkty doświadczenia dla zdobywcy pola.'
  )
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description;
