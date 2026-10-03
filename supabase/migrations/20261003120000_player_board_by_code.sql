-- One active board by code for the anonymous server client.
-- No table policy and no anon grant on sessions or board_cells.

CREATE FUNCTION public.get_active_board_by_code(p_code text)
RETURNS TABLE (
  code text,
  size smallint,
  position smallint,
  phrase text,
  reward_slug text,
  reward_label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.code, s.size, c.position, c.phrase, r.slug, r.label
  FROM public.sessions s
  JOIN public.board_cells c ON c.session_id = s.id
  LEFT JOIN public.rewards r ON r.id = c.reward_id
  WHERE s.code = p_code
    AND s.status = 'active'
  ORDER BY c.position;
$$;

REVOKE ALL ON FUNCTION public.get_active_board_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_board_by_code(text) TO anon, authenticated;
