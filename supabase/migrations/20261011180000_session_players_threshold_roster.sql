-- Player roster: claimed counts + earned threshold reward (label only once met).

DROP FUNCTION IF EXISTS public.get_session_players_by_code(text);

CREATE FUNCTION public.get_session_players_by_code(p_code text)
RETURNS TABLE (
  nick text,
  color smallint,
  created_at timestamptz,
  claimed_count integer,
  threshold_count smallint,
  threshold_reward_slug text,
  threshold_reward_label text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sp.nick,
    sp.color,
    sp.created_at,
    (
      SELECT COUNT(*)::integer
      FROM public.board_cells c
      WHERE c.session_id = s.id
        AND c.claimed_by_player_id = sp.id
    ) AS claimed_count,
    s.threshold_count,
    CASE
      WHEN s.threshold_count IS NOT NULL
           AND sp.threshold_reward_id IS NOT NULL
           AND (
             SELECT COUNT(*)::integer
             FROM public.board_cells c
             WHERE c.session_id = s.id
               AND c.claimed_by_player_id = sp.id
           ) >= s.threshold_count
      THEN r.slug
      ELSE NULL
    END AS threshold_reward_slug,
    CASE
      WHEN s.threshold_count IS NOT NULL
           AND sp.threshold_reward_id IS NOT NULL
           AND (
             SELECT COUNT(*)::integer
             FROM public.board_cells c
             WHERE c.session_id = s.id
               AND c.claimed_by_player_id = sp.id
           ) >= s.threshold_count
      THEN r.label
      ELSE NULL
    END AS threshold_reward_label
  FROM public.sessions s
  JOIN public.session_players sp ON sp.session_id = s.id
  LEFT JOIN public.rewards r ON r.id = sp.threshold_reward_id
  WHERE s.code = p_code
    AND s.status IN ('active', 'closed')
  ORDER BY sp.created_at;
$$;

REVOKE ALL ON FUNCTION public.get_session_players_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_session_players_by_code(text) TO anon, authenticated;
