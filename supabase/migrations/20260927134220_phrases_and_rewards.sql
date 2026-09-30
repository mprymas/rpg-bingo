-- Catalog tables for predefined RPG phrases and admin rewards (F-01).
-- Read-only for anon and authenticated; no client write policies.

CREATE TABLE public.phrases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (text)
);

CREATE TABLE public.rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  label text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug)
);

ALTER TABLE public.phrases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "phrases_select_anon"
  ON public.phrases
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "phrases_select_authenticated"
  ON public.phrases
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "rewards_select_anon"
  ON public.rewards
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "rewards_select_authenticated"
  ON public.rewards
  FOR SELECT
  TO authenticated
  USING (true);
