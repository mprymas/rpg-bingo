-- GM close-with-successor: soft-close an active session and link the replacement.
-- SECURITY DEFINER so RLS never needs UPDATE on sessions for GMs. No DELETE policy.

ALTER TABLE public.sessions
  ADD COLUMN replaced_by_session_id uuid NULL REFERENCES public.sessions (id) ON DELETE SET NULL;

CREATE FUNCTION public.close_session_as_replaced(
  p_session_id uuid,
  p_replaced_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gm_id uuid;
  v_status text;
  v_replacement_gm_id uuid;
BEGIN
  SELECT s.gm_id, s.status
  INTO v_gm_id, v_status
  FROM public.sessions s
  WHERE s.id = p_session_id;

  IF v_gm_id IS NULL THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_gm_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF v_status IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'session_not_active' USING ERRCODE = 'P0001';
  END IF;

  IF p_replaced_by = p_session_id THEN
    RAISE EXCEPTION 'replacement_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT s.gm_id
  INTO v_replacement_gm_id
  FROM public.sessions s
  WHERE s.id = p_replaced_by
    AND s.status = 'active';

  IF v_replacement_gm_id IS NULL OR v_replacement_gm_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'replacement_not_found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.sessions
  SET
    status = 'closed',
    replaced_by_session_id = p_replaced_by
  WHERE id = p_session_id
    AND status = 'active';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_active' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.close_session_as_replaced(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_session_as_replaced(uuid, uuid) TO authenticated;
