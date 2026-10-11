-- Player board snapshot: active or closed (unknown codes still return zero rows).
-- Adds status + successor_code; extends roster RPC to closed sessions.

DROP FUNCTION IF EXISTS public.get_active_board_by_code(text);

CREATE FUNCTION public.get_active_board_by_code(p_code text)
RETURNS TABLE (
  code text,
  size smallint,
  status text,
  successor_code text,
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
    s.status,
    successor.code AS successor_code,
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
  LEFT JOIN public.sessions successor ON successor.id = s.replaced_by_session_id
  WHERE s.code = p_code
    AND s.status IN ('active', 'closed')
  ORDER BY c.position;
$$;

REVOKE ALL ON FUNCTION public.get_active_board_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_board_by_code(text) TO anon, authenticated;

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
    AND s.status IN ('active', 'closed')
  ORDER BY sp.created_at;
$$;

REVOKE ALL ON FUNCTION public.get_session_players_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_session_players_by_code(text) TO anon, authenticated;
