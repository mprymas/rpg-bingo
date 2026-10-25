-- Publish a GM phrase draft in one transaction. Phrase text only; reward and claim columns stay.
-- SECURITY DEFINER so RLS never needs UPDATE on board_cells for GMs.
-- Normalized uniqueness is the SQL twin of normalizePhrase: trim, collapse whitespace, then lower.

CREATE FUNCTION public.commit_phrase_rerolls(
  p_session_id uuid,
  p_changes jsonb
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
  v_positions text;
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

  IF p_changes IS NULL
     OR jsonb_typeof(p_changes) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_changes) = 0 THEN
    RAISE EXCEPTION 'invalid_position' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_changes) AS elem
    WHERE jsonb_typeof(elem) IS DISTINCT FROM 'object'
       OR jsonb_typeof(elem -> 'position') IS DISTINCT FROM 'number'
       OR (elem ->> 'position') !~ '^[0-9]+$'
       OR char_length(elem ->> 'position') > 4
       OR jsonb_typeof(elem -> 'phrase') IS DISTINCT FROM 'string'
       OR btrim(elem ->> 'phrase') = ''
  ) THEN
    RAISE EXCEPTION 'invalid_position' USING ERRCODE = '22023';
  END IF;

  IF (
    SELECT COUNT(*)
    FROM jsonb_array_elements(p_changes) AS elem
  ) <> (
    SELECT COUNT(DISTINCT (elem ->> 'position')::integer)
    FROM jsonb_array_elements(p_changes) AS elem
  ) THEN
    RAISE EXCEPTION 'invalid_position' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_changes) AS elem
    WHERE (elem ->> 'position')::integer >= (v_size * v_size)
  ) THEN
    RAISE EXCEPTION 'invalid_position' USING ERRCODE = '22023';
  END IF;

  -- Lock every cell before claim, catalog, and duplicate checks so a concurrent claim cannot split the write.
  PERFORM c.position
  FROM public.board_cells c
  WHERE c.session_id = v_session_id
  ORDER BY c.position
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT (elem ->> 'position')::smallint AS position
      FROM jsonb_array_elements(p_changes) AS elem
    ) ch
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.board_cells c
      WHERE c.session_id = v_session_id
        AND c.position = ch.position
    )
  ) THEN
    RAISE EXCEPTION 'cell_not_found' USING ERRCODE = 'P0002';
  END IF;

  SELECT string_agg(c.position::text, ',' ORDER BY c.position)
  INTO v_positions
  FROM public.board_cells c
  INNER JOIN (
    SELECT (elem ->> 'position')::smallint AS position
    FROM jsonb_array_elements(p_changes) AS elem
  ) ch ON ch.position = c.position
  WHERE c.session_id = v_session_id
    AND c.claimed_by_player_id IS NOT NULL;

  IF v_positions IS NOT NULL THEN
    RAISE EXCEPTION 'cell_claimed:%', v_positions USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_changes) AS elem
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.phrases p
      WHERE p.text = (elem ->> 'phrase')
    )
  ) THEN
    RAISE EXCEPTION 'phrase_not_in_catalog' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT lower(
        btrim(
          regexp_replace(
            CASE
              WHEN ch.phrase IS NOT NULL THEN ch.phrase
              ELSE c.phrase
            END,
            '\s+',
            ' ',
            'g'
          )
        )
      ) AS norm
      FROM public.board_cells c
      LEFT JOIN (
        SELECT
          (elem ->> 'position')::smallint AS position,
          elem ->> 'phrase' AS phrase
        FROM jsonb_array_elements(p_changes) AS elem
      ) ch ON ch.position = c.position
      WHERE c.session_id = v_session_id
    ) applied
    GROUP BY applied.norm
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate_phrase' USING ERRCODE = '23505';
  END IF;

  UPDATE public.board_cells c
  SET phrase = ch.phrase
  FROM (
    SELECT
      (elem ->> 'position')::smallint AS position,
      elem ->> 'phrase' AS phrase
    FROM jsonb_array_elements(p_changes) AS elem
  ) ch
  WHERE c.session_id = v_session_id
    AND c.position = ch.position;

  RETURN QUERY
  SELECT
    c.position,
    c.phrase,
    (c.reward_id IS NOT NULL),
    r.slug,
    r.label,
    sp.color
  FROM public.board_cells c
  INNER JOIN (
    SELECT (elem ->> 'position')::smallint AS position
    FROM jsonb_array_elements(p_changes) AS elem
  ) ch ON ch.position = c.position
  LEFT JOIN public.rewards r ON r.id = c.reward_id
  LEFT JOIN public.session_players sp ON sp.id = c.claimed_by_player_id
  WHERE c.session_id = v_session_id
  ORDER BY c.position;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'cell_not_found' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.commit_phrase_rerolls(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.commit_phrase_rerolls(uuid, jsonb) TO authenticated;
