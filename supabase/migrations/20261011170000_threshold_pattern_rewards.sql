-- Threshold + row/column reward rules: pool selections, pre-drawn lines,
-- per-player threshold draw on join, and a hidden-info-safe player inputs RPC.

ALTER TABLE public.sessions
  ADD COLUMN threshold_count smallint NULL;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_threshold_count_chk
  CHECK (threshold_count IS NULL OR threshold_count BETWEEN 1 AND (size * size));

ALTER TABLE public.session_players
  ADD COLUMN threshold_reward_id uuid NULL REFERENCES public.rewards (id);

CREATE TABLE public.session_reward_pool (
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('line', 'threshold')),
  reward_id uuid NOT NULL REFERENCES public.rewards (id),
  PRIMARY KEY (session_id, kind, reward_id)
);

CREATE TABLE public.board_lines (
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  axis text NOT NULL CHECK (axis IN ('row', 'column')),
  index smallint NOT NULL CHECK (index >= 0),
  reward_id uuid NOT NULL REFERENCES public.rewards (id),
  PRIMARY KEY (session_id, axis, index)
);

ALTER TABLE public.session_reward_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "session_reward_pool_select_authenticated"
  ON public.session_reward_pool
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

CREATE POLICY "session_reward_pool_insert_authenticated"
  ON public.session_reward_pool
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

CREATE POLICY "board_lines_select_authenticated"
  ON public.board_lines
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

CREATE POLICY "board_lines_insert_authenticated"
  ON public.board_lines
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

CREATE OR REPLACE FUNCTION public.join_session_player(
  p_code text,
  p_nick text,
  p_claim_token uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  claim_token uuid,
  color smallint,
  nick text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_nick text;
  v_existing_id uuid;
  v_existing_token uuid;
  v_existing_color smallint;
  v_join_ordinal integer;
  v_color smallint;
  v_threshold_reward_id uuid;
BEGIN
  v_nick := btrim(p_nick);
  IF v_nick = '' OR char_length(v_nick) > 24 OR v_nick ~ E'[\\x00-\\x1f]' THEN
    RAISE EXCEPTION 'invalid_nick' USING ERRCODE = '22023';
  END IF;

  SELECT s.id
  INTO v_session_id
  FROM public.sessions s
  WHERE s.code = p_code
    AND s.status = 'active'
  FOR UPDATE;

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_claim_token IS NOT NULL THEN
    SELECT sp.id, sp.claim_token, sp.color
    INTO v_existing_id, v_existing_token, v_existing_color
    FROM public.session_players sp
    WHERE sp.claim_token = p_claim_token
      AND sp.session_id = v_session_id;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.session_players sp
      SET nick = v_nick
      WHERE sp.id = v_existing_id
        AND sp.nick IS DISTINCT FROM v_nick;

      RETURN QUERY SELECT v_existing_id, v_existing_token, v_existing_color, v_nick;
      RETURN;
    END IF;
  END IF;

  SELECT COUNT(*)::integer + 1
  INTO v_join_ordinal
  FROM public.session_players sp
  WHERE sp.session_id = v_session_id;

  -- Soft table size: max 10 distinct join seats per session (rebind via claim_token still allowed).
  IF v_join_ordinal > 10 THEN
    RAISE EXCEPTION 'session_full' USING ERRCODE = 'P0001';
  END IF;

  v_color := ((v_join_ordinal - 1) % 8) + 1;

  SELECT srp.reward_id
  INTO v_threshold_reward_id
  FROM public.session_reward_pool srp
  WHERE srp.session_id = v_session_id
    AND srp.kind = 'threshold'
  ORDER BY random()
  LIMIT 1;

  RETURN QUERY
  INSERT INTO public.session_players (session_id, nick, color, threshold_reward_id)
  VALUES (v_session_id, v_nick, v_color, v_threshold_reward_id)
  RETURNING session_players.id, session_players.claim_token, session_players.color, session_players.nick;
END;
$$;

REVOKE ALL ON FUNCTION public.join_session_player(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_session_player(text, text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_player_reward_inputs(
  p_code text,
  p_claim_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_size smallint;
  v_threshold_count smallint;
  v_player_id uuid;
  v_threshold_reward_id uuid;
  v_claimed_count integer;
  v_threshold_reward jsonb;
  v_cells jsonb;
  v_lines jsonb;
BEGIN
  SELECT s.id, s.size, s.threshold_count
  INTO v_session_id, v_size, v_threshold_count
  FROM public.sessions s
  WHERE s.code = p_code
    AND s.status IN ('active', 'closed');

  IF v_session_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT sp.id, sp.threshold_reward_id
  INTO v_player_id, v_threshold_reward_id
  FROM public.session_players sp
  WHERE sp.claim_token = p_claim_token
    AND sp.session_id = v_session_id;

  IF v_player_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*)::integer
  INTO v_claimed_count
  FROM public.board_cells c
  WHERE c.session_id = v_session_id
    AND c.claimed_by_player_id = v_player_id;

  IF v_threshold_count IS NOT NULL
     AND v_claimed_count >= v_threshold_count
     AND v_threshold_reward_id IS NOT NULL THEN
    SELECT jsonb_build_object('slug', r.slug, 'label', r.label)
    INTO v_threshold_reward
    FROM public.rewards r
    WHERE r.id = v_threshold_reward_id;
  ELSE
    v_threshold_reward := NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'position', c.position,
        'claimed_at', c.claimed_at,
        'is_mine', (c.claimed_by_player_id = v_player_id)
      )
      ORDER BY c.position
    ),
    '[]'::jsonb
  )
  INTO v_cells
  FROM public.board_cells c
  WHERE c.session_id = v_session_id
    AND c.claimed_by_player_id IS NOT NULL;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'axis', bl.axis,
        'index', bl.index,
        'slug', r.slug,
        'label', r.label
      )
      ORDER BY bl.axis, bl.index
    ),
    '[]'::jsonb
  )
  INTO v_lines
  FROM public.board_lines bl
  JOIN public.rewards r ON r.id = bl.reward_id
  WHERE bl.session_id = v_session_id
    AND (
      CASE bl.axis
        WHEN 'row' THEN (
          SELECT COUNT(*)::integer
          FROM public.board_cells c
          WHERE c.session_id = v_session_id
            AND c.claimed_by_player_id IS NOT NULL
            AND c.position >= (bl.index * v_size)
            AND c.position < ((bl.index + 1) * v_size)
        ) = v_size
        WHEN 'column' THEN (
          SELECT COUNT(*)::integer
          FROM public.board_cells c
          WHERE c.session_id = v_session_id
            AND c.claimed_by_player_id IS NOT NULL
            AND MOD(c.position, v_size) = bl.index
        ) = v_size
        ELSE false
      END
    );

  RETURN jsonb_build_object(
    'size', v_size,
    'threshold_count', v_threshold_count,
    'threshold_reward', v_threshold_reward,
    'cells', v_cells,
    'lines', v_lines
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_player_reward_inputs(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_reward_inputs(text, uuid) TO anon, authenticated;
