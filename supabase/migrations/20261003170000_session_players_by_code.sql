-- Anonymous roster read for player board poll (nick + color only).
-- No table SELECT for anon — SECURITY DEFINER only.

CREATE FUNCTION public.get_session_players_by_code(p_code text)
RETURNS TABLE (
  id uuid,
  nick text,
  color smallint,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT sp.id, sp.nick, sp.color, sp.created_at
  FROM public.sessions s
  JOIN public.session_players sp ON sp.session_id = s.id
  WHERE s.code = p_code
    AND s.status = 'active'
  ORDER BY sp.created_at;
$$;

REVOKE ALL ON FUNCTION public.get_session_players_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_session_players_by_code(text) TO anon, authenticated;
