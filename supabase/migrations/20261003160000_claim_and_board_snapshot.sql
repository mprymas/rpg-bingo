-- First-wins claim RPC + player-safe board snapshot (mystery until claim).
-- Replaces get_active_board_by_code return shape (DROP required for column change).

DROP FUNCTION IF EXISTS public.get_active_board_by_code(text);

CREATE FUNCTION public.get_active_board_by_code(p_code text)
RETURNS TABLE (
  code text,
  size smallint,
  "position" smallint,
  phrase text,
  has_reward boolean,
  reward_slug text,
  reward_label text,
  claimed_by_color smallint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.code,
    s.size,
    c.position,
    c.phrase,
    (c.reward_id IS NOT NULL) AS has_reward,
    CASE
      WHEN c.claimed_by_player_id IS NOT NULL THEN r.slug
      ELSE NULL
    END AS reward_slug,
    CASE
      WHEN c.claimed_by_player_id IS NOT NULL THEN r.label
      ELSE NULL
    END AS reward_label,
    sp.color AS claimed_by_color
  FROM public.sessions s
  JOIN public.board_cells c ON c.session_id = s.id
  LEFT JOIN public.rewards r ON r.id = c.reward_id
  LEFT JOIN public.session_players sp ON sp.id = c.claimed_by_player_id
  WHERE s.code = p_code
    AND s.status = 'active'
  ORDER BY c.position;
$$;

REVOKE ALL ON FUNCTION public.get_active_board_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_board_by_code(text) TO anon, authenticated;

CREATE FUNCTION public.claim_board_cell(
  p_code text,
  p_player_id uuid,
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
  v_player_ok boolean;
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

  SELECT EXISTS (
    SELECT 1
    FROM public.session_players sp
    WHERE sp.id = p_player_id
      AND sp.session_id = v_session_id
  )
  INTO v_player_ok;

  IF NOT v_player_ok THEN
    RAISE EXCEPTION 'player_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_position < 0 OR p_position >= (v_size * v_size) THEN
    RAISE EXCEPTION 'invalid_position' USING ERRCODE = '22023';
  END IF;

  UPDATE public.board_cells c
  SET
    claimed_by_player_id = p_player_id,
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
