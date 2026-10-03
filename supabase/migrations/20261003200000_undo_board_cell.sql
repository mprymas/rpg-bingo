-- GM undo: clear claim occupancy on a cell; keep reward_id for reclaim.
-- SECURITY DEFINER so RLS never needs UPDATE on board_cells for GMs.

CREATE FUNCTION public.undo_board_cell(
  p_session_id uuid,
  p_position smallint
)
RETURNS TABLE (
  "position" smallint,
  phrase text,
  has_reward boolean,
  reward_slug text,
  reward_label text,
  claimed_by_color smallint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_size smallint;
BEGIN
  SELECT s.id, s.size
  INTO v_session_id, v_size
  FROM public.sessions s
  WHERE s.id = p_session_id
    AND s.gm_id = auth.uid()
    AND s.status = 'active';

  IF v_session_id IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_position < 0 OR p_position >= (v_size * v_size) THEN
    RAISE EXCEPTION 'invalid_position' USING ERRCODE = '22023';
  END IF;

  UPDATE public.board_cells c
  SET
    claimed_by_player_id = NULL,
    claimed_at = NULL
  WHERE c.session_id = v_session_id
    AND c.position = p_position
    AND c.claimed_by_player_id IS NOT NULL;

  RETURN QUERY
  SELECT
    c.position,
    c.phrase,
    (c.reward_id IS NOT NULL),
    r.slug,
    r.label,
    NULL::smallint
  FROM public.board_cells c
  LEFT JOIN public.rewards r ON r.id = c.reward_id
  WHERE c.session_id = v_session_id
    AND c.position = p_position;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cell_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.undo_board_cell(uuid, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.undo_board_cell(uuid, smallint) TO authenticated;
