-- Session joiners and first-wins claim columns on board cells (S-03).
-- GM-owner SELECT on session_players; no anon table grants.
-- Claim writes go through SECURITY DEFINER functions in later migrations.

CREATE TABLE public.session_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  nick text NOT NULL,
  color smallint NOT NULL CHECK (color BETWEEN 1 AND 16),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX session_players_session_id_created_at_idx
  ON public.session_players (session_id, created_at);

ALTER TABLE public.session_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_players_select_authenticated"
  ON public.session_players
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

ALTER TABLE public.board_cells
  ADD COLUMN claimed_by_player_id uuid NULL REFERENCES public.session_players (id),
  ADD COLUMN claimed_at timestamptz NULL;

ALTER TABLE public.board_cells
  ADD CONSTRAINT board_cells_claim_pair_chk
  CHECK (
    (claimed_by_player_id IS NULL AND claimed_at IS NULL)
    OR (claimed_by_player_id IS NOT NULL AND claimed_at IS NOT NULL)
  );
