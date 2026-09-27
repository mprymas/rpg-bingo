-- Session (= one board, one code) and board cells for GM create flow (S-01).
-- Owner-only RLS for authenticated; no anon / UPDATE / DELETE policies.

CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gm_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE CHECK (code ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
  size smallint NOT NULL CHECK (size BETWEEN 3 AND 5),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sessions_gm_id_created_at_idx
  ON public.sessions (gm_id, created_at DESC);

CREATE TABLE public.board_cells (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  position smallint NOT NULL CHECK (position >= 0),
  phrase text NOT NULL,
  reward_id uuid NULL REFERENCES public.rewards (id),
  UNIQUE (session_id, position),
  UNIQUE (session_id, phrase)
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_cells ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select_authenticated"
  ON public.sessions
  FOR SELECT
  TO authenticated
  USING (gm_id = auth.uid());

CREATE POLICY "sessions_insert_authenticated"
  ON public.sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (gm_id = auth.uid());

CREATE POLICY "board_cells_select_authenticated"
  ON public.board_cells
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = session_id
        AND s.gm_id = auth.uid()
    )
  );

CREATE POLICY "board_cells_insert_authenticated"
  ON public.board_cells
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = session_id
        AND s.gm_id = auth.uid()
    )
  );
