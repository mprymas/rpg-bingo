-- Include per-field rewards earned by this player in get_player_reward_inputs
-- so the player "Twoje nagrody" list can list them alongside threshold/line rewards.

CREATE OR REPLACE FUNCTION public.get_player_reward_inputs(
  p_code text,
  p_claim_token uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
  v_size smallint;
  v_threshold_count smallint;
  v_player_id uuid;
  v_threshold_reward_id uuid;
  v_claimed_count integer;
  v_threshold_reward jsonb;
  v_cells jsonb;
  v_lines jsonb;
  v_field_rewards jsonb;
  v_has_line_rules boolean;
BEGIN
  SELECT s.id, s.size, s.threshold_count
  INTO v_session_id, v_size, v_threshold_count
  FROM public.sessions s
  WHERE s.code = p_code
    AND s.status IN ('active', 'closed');

  IF v_session_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT sp.id, sp.threshold_reward_id
  INTO v_player_id, v_threshold_reward_id
  FROM public.session_players sp
  WHERE sp.claim_token = p_claim_token
    AND sp.session_id = v_session_id;

  IF v_player_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.board_lines bl
    WHERE bl.session_id = v_session_id
  )
  INTO v_has_line_rules;

  SELECT COUNT(*)::integer
  INTO v_claimed_count
  FROM public.board_cells c
  WHERE c.session_id = v_session_id
    AND c.claimed_by_player_id = v_player_id;

  IF v_threshold_count IS NOT NULL
     AND v_claimed_count >= v_threshold_count
     AND v_threshold_reward_id IS NOT NULL THEN
    SELECT jsonb_build_object('slug', r.slug, 'label', r.label)
    INTO v_threshold_reward
    FROM public.rewards r
    WHERE r.id = v_threshold_reward_id;
  ELSE
    v_threshold_reward := NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'position', c.position,
        'claimed_at', c.claimed_at,
        'is_mine', (c.claimed_by_player_id = v_player_id)
      )
      ORDER BY c.position
    ),
    '[]'::jsonb
  )
  INTO v_cells
  FROM public.board_cells c
  WHERE c.session_id = v_session_id
    AND c.claimed_by_player_id IS NOT NULL;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'axis', bl.axis,
        'index', bl.index,
        'slug', r.slug,
        'label', r.label
      )
      ORDER BY bl.axis, bl.index
    ),
    '[]'::jsonb
  )
  INTO v_lines
  FROM public.board_lines bl
  JOIN public.rewards r ON r.id = bl.reward_id
  WHERE bl.session_id = v_session_id
    AND (
      CASE bl.axis
        WHEN 'row' THEN (
          SELECT COUNT(*)::integer
          FROM public.board_cells c
          WHERE c.session_id = v_session_id
            AND c.claimed_by_player_id IS NOT NULL
            AND c.position >= (bl.index * v_size)
            AND c.position < ((bl.index + 1) * v_size)
        ) = v_size
        WHEN 'column' THEN (
          SELECT COUNT(*)::integer
          FROM public.board_cells c
          WHERE c.session_id = v_session_id
            AND c.claimed_by_player_id IS NOT NULL
            AND MOD(c.position, v_size) = bl.index
        ) = v_size
        ELSE false
      END
    );

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('slug', r.slug, 'label', r.label)
      ORDER BY c.position
    ),
    '[]'::jsonb
  )
  INTO v_field_rewards
  FROM public.board_cells c
  JOIN public.rewards r ON r.id = c.reward_id
  WHERE c.session_id = v_session_id
    AND c.claimed_by_player_id = v_player_id
    AND c.reward_id IS NOT NULL;

  RETURN jsonb_build_object(
    'size', v_size,
    'threshold_count', v_threshold_count,
    'has_line_rules', v_has_line_rules,
    'threshold_reward', v_threshold_reward,
    'cells', v_cells,
    'lines', v_lines,
    'field_rewards', v_field_rewards
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_player_reward_inputs(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_reward_inputs(text, uuid) TO anon, authenticated;
