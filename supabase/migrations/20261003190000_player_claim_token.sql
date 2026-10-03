-- Claim capability token: issued only at join (via cookie), never on player roster poll.
-- Roster RPC returns nick/color only — no session_players.id.

ALTER TABLE public.session_players
  ADD COLUMN claim_token uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE public.session_players
  ADD CONSTRAINT session_players_claim_token_key UNIQUE (claim_token);

DROP FUNCTION IF EXISTS public.get_session_players_by_code(text);

CREATE FUNCTION public.get_session_players_by_code(p_code text)
RETURNS TABLE (
  nick text,
  color smallint,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.nick, sp.color, sp.created_at
  FROM public.sessions s
  JOIN public.session_players sp ON sp.session_id = s.id
  WHERE s.code = p_code
    AND s.status = 'active'
  ORDER BY sp.created_at;
$$;

REVOKE ALL ON FUNCTION public.get_session_players_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_session_players_by_code(text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.join_session_player(text, text, uuid);

CREATE FUNCTION public.join_session_player(
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

  RETURN QUERY
  INSERT INTO public.session_players (session_id, nick, color)
  VALUES (v_session_id, v_nick, v_color)
  RETURNING session_players.id, session_players.claim_token, session_players.color, session_players.nick;
END;
$$;

REVOKE ALL ON FUNCTION public.join_session_player(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_session_player(text, text, uuid) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.claim_board_cell(text, uuid, smallint);

CREATE FUNCTION public.claim_board_cell(
  p_code text,
  p_claim_token uuid,
  p_position smallint
)
RETURNS TABLE (
  status text,
  "position" smallint,
  phrase text,
  has_reward boolean,
  reward_slug text,
  reward_label text,
  claimed_by_color smallint,
  occupant_nick text,
  occupant_color smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_size smallint;
  v_player_id uuid;
  v_now timestamptz := now();
BEGIN
  SELECT s.id, s.size
  INTO v_session_id, v_size
  FROM public.sessions s
  WHERE s.code = p_code
    AND s.status = 'active';

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT sp.id
  INTO v_player_id
  FROM public.session_players sp
  WHERE sp.claim_token = p_claim_token
    AND sp.session_id = v_session_id;

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'player_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_position < 0 OR p_position >= (v_size * v_size) THEN
    RAISE EXCEPTION 'invalid_position' USING ERRCODE = '22023';
  END IF;

  UPDATE public.board_cells c
  SET
    claimed_by_player_id = v_player_id,
    claimed_at = v_now
  WHERE c.session_id = v_session_id
    AND c.position = p_position
    AND c.claimed_by_player_id IS NULL;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      'claimed'::text,
      c.position,
      c.phrase,
      (c.reward_id IS NOT NULL),
      r.slug,
      r.label,
      sp.color,
      NULL::text,
      NULL::smallint
    FROM public.board_cells c
    LEFT JOIN public.rewards r ON r.id = c.reward_id
    JOIN public.session_players sp ON sp.id = c.claimed_by_player_id
    WHERE c.session_id = v_session_id
      AND c.position = p_position;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.board_cells c
    WHERE c.session_id = v_session_id
      AND c.position = p_position
  ) THEN
    RAISE EXCEPTION 'cell_not_found' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  SELECT
    'conflict'::text,
    c.position,
    c.phrase,
    (c.reward_id IS NOT NULL),
    r.slug,
    r.label,
    sp.color,
    sp.nick,
    sp.color
  FROM public.board_cells c
  LEFT JOIN public.rewards r ON r.id = c.reward_id
  JOIN public.session_players sp ON sp.id = c.claimed_by_player_id
  WHERE c.session_id = v_session_id
    AND c.position = p_position;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_board_cell(text, uuid, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_board_cell(text, uuid, smallint) TO anon, authenticated;
