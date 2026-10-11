-- GM hard-delete: remove an owned session of any status (CASCADE children).
-- SECURITY DEFINER so RLS never needs DELETE on sessions for GMs. No DELETE policy.

CREATE FUNCTION public.delete_session(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gm_id uuid;
BEGIN
  SELECT s.gm_id
  INTO v_gm_id
  FROM public.sessions s
  WHERE s.id = p_session_id;

  IF v_gm_id IS NULL OR v_gm_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;

  DELETE FROM public.sessions
  WHERE id = p_session_id
    AND gm_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_session(uuid) TO authenticated;
