-- Catalog seed for hosted F-01 apply (do not db reset).
-- Safe to re-run: phrases skip duplicates; rewards upsert label/description by slug.
-- Reward ids are fixed so local/CI share the same id-per-slug map (tests/helpers/seed-rewards.ts).
-- Existing local DBs with random reward ids need a local-only `supabase db reset` so ids match.

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

INSERT INTO public.rewards (id, slug, label, description) VALUES
  (
    'ae52e490-555f-4f60-8313-1e26cc9ee71a',
    'inspiration',
    'Inspiracja',
    'Przyznanie inspiracji dla zdobywcy pola.'
  ),
  (
    '5dc80d76-2947-4f78-84a0-f0cbc1c7bddf',
    'item',
    'Przedmiot',
    'Drobny przedmiot fabularny lub użytkowy.'
  ),
  (
    'cc7aa51f-cfdd-4454-89c5-30dcc9759a2f',
    'side-quest',
    'Zadanie poboczne',
    'Krótki wątek poboczny dla drużyny.'
  ),
  (
    '44185abe-9d08-4b3a-bd85-3beba1dfaf25',
    'clue',
    'Wskazówka',
    'MG zdradza jedną użyteczną wskazówkę związaną z bieżącą sytuacją.'
  ),
  (
    '848e72a5-b072-40b1-9113-28cf0f9c3243',
    'npc-help',
    'Pomoc w walce',
    'Wprowadzenie pomocy do następnej walki za pomocą NPC.'
  ),
  (
    'cc7e81db-165e-4de0-ada8-7839a84d0a19',
    'experience',
    'Doświadczenie',
    'Dodatkowe punkty doświadczenia dla zdobywcy pola.'
  )
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description;
