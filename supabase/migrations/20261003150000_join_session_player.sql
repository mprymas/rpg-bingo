-- Anonymous join: insert (or rebind) a session_players row without table INSERT for anon.
-- Optional p_player_id keeps an existing row when it still belongs to the active session.

CREATE FUNCTION public.join_session_player(
  p_code text,
  p_nick text,
  p_player_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
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

  IF p_player_id IS NOT NULL THEN
    SELECT sp.id, sp.color
    INTO v_existing_id, v_existing_color
    FROM public.session_players sp
    WHERE sp.id = p_player_id
      AND sp.session_id = v_session_id;

    IF v_existing_id IS NOT NULL THEN
      UPDATE public.session_players sp
      SET nick = v_nick
      WHERE sp.id = v_existing_id
        AND sp.nick IS DISTINCT FROM v_nick;

      RETURN QUERY SELECT v_existing_id, v_existing_color, v_nick;
      RETURN;
    END IF;
  END IF;

  SELECT COUNT(*)::integer + 1
  INTO v_join_ordinal
  FROM public.session_players sp
  WHERE sp.session_id = v_session_id;

  v_color := ((v_join_ordinal - 1) % 16) + 1;

  RETURN QUERY
  INSERT INTO public.session_players (session_id, nick, color)
  VALUES (v_session_id, v_nick, v_color)
  RETURNING session_players.id, session_players.color, session_players.nick;
END;
$$;

REVOKE ALL ON FUNCTION public.join_session_player(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_session_player(text, text, uuid) TO anon, authenticated;
