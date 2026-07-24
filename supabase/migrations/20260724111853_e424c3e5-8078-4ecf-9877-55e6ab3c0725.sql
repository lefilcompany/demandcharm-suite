ALTER TABLE public.demand_requests
ADD COLUMN IF NOT EXISTS approved_demand_id uuid REFERENCES public.demands(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.approve_demand_request(
  p_request_id uuid,
  p_assignee_ids uuid[] DEFAULT '{}'::uuid[],
  p_due_date timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_request public.demand_requests%ROWTYPE;
  v_default_status_id uuid;
  v_parent_demand_id uuid;
  v_subdemand_ids uuid[] := ARRAY[]::uuid[];
  v_sub jsonb;
  v_subdemand_id uuid;
  v_sub_index integer := 0;
  v_dep_index integer;
  v_depends_on_index integer;
  v_primary_assignee uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT *
  INTO v_request
  FROM public.demand_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada';
  END IF;

  IF v_request.board_id IS NULL THEN
    RAISE EXCEPTION 'Solicitação sem quadro vinculado não pode ser aprovada';
  END IF;

  IF NOT (
    public.is_team_admin_or_moderator(v_user_id, v_request.team_id)
    OR public.is_board_admin_or_moderator(v_user_id, v_request.board_id)
  ) THEN
    RAISE EXCEPTION 'Você não tem permissão de aprovador neste quadro';
  END IF;

  IF v_request.status = 'approved' THEN
    IF v_request.approved_demand_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'parent_id', v_request.approved_demand_id,
        'subdemand_ids', '[]'::jsonb,
        'already_approved', true
      );
    END IF;

    RAISE EXCEPTION 'Solicitação já aprovada';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Apenas solicitações pendentes podem ser aprovadas';
  END IF;

  SELECT bs.status_id
  INTO v_default_status_id
  FROM public.board_statuses bs
  JOIN public.demand_statuses ds ON ds.id = bs.status_id
  WHERE bs.board_id = v_request.board_id
    AND bs.is_active = true
    AND ds.name = 'A Iniciar'
  ORDER BY bs.position ASC
  LIMIT 1;

  IF v_default_status_id IS NULL THEN
    SELECT bs.status_id
    INTO v_default_status_id
    FROM public.board_statuses bs
    WHERE bs.board_id = v_request.board_id
      AND bs.is_active = true
    ORDER BY bs.position ASC
    LIMIT 1;
  END IF;

  IF v_default_status_id IS NULL THEN
    RAISE EXCEPTION 'Status padrão não encontrado para este quadro';
  END IF;

  IF array_length(p_assignee_ids, 1) IS NOT NULL THEN
    SELECT assignee_id
    INTO v_primary_assignee
    FROM unnest(p_assignee_ids) WITH ORDINALITY AS t(assignee_id, ord)
    ORDER BY ord
    LIMIT 1;
  END IF;

  INSERT INTO public.demands (
    team_id,
    board_id,
    created_by,
    title,
    description,
    priority,
    service_id,
    status_id,
    due_date,
    assigned_to,
    status_changed_by
  ) VALUES (
    v_request.team_id,
    v_request.board_id,
    v_request.created_by,
    v_request.title,
    v_request.description,
    COALESCE(v_request.priority, 'média'),
    v_request.service_id,
    v_default_status_id,
    p_due_date,
    v_primary_assignee,
    v_user_id
  )
  RETURNING id INTO v_parent_demand_id;

  IF array_length(p_assignee_ids, 1) IS NOT NULL THEN
    INSERT INTO public.demand_assignees (demand_id, user_id, is_primary)
    SELECT v_parent_demand_id, assignee_id, ord = 1
    FROM unnest(p_assignee_ids) WITH ORDINALITY AS t(assignee_id, ord)
    ON CONFLICT (demand_id, user_id) DO UPDATE
    SET is_primary = EXCLUDED.is_primary;
  END IF;

  INSERT INTO public.demand_attachments (
    demand_id,
    file_name,
    file_path,
    file_type,
    file_size,
    uploaded_by
  )
  SELECT
    v_parent_demand_id,
    dra.file_name,
    dra.file_path,
    dra.file_type,
    dra.file_size,
    v_user_id
  FROM public.demand_request_attachments dra
  WHERE dra.demand_request_id = p_request_id
    AND dra.comment_id IS NULL
    AND dra.subdemand_index IS NULL;

  FOR v_sub IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(v_request.subdemands_plan, '[]'::jsonb)) AS s(value)
  LOOP
    INSERT INTO public.demands (
      team_id,
      board_id,
      created_by,
      parent_demand_id,
      title,
      description,
      priority,
      service_id,
      status_id,
      due_date,
      status_changed_by
    ) VALUES (
      v_request.team_id,
      v_request.board_id,
      v_request.created_by,
      v_parent_demand_id,
      COALESCE(NULLIF(v_sub->>'title', ''), 'Subdemanda'),
      NULLIF(v_sub->>'description', ''),
      COALESCE(NULLIF(v_sub->>'priority', ''), 'média'),
      NULLIF(v_sub->>'service_id', '')::uuid,
      v_default_status_id,
      NULL,
      v_user_id
    )
    RETURNING id INTO v_subdemand_id;

    v_subdemand_ids := array_append(v_subdemand_ids, v_subdemand_id);

    INSERT INTO public.demand_attachments (
      demand_id,
      file_name,
      file_path,
      file_type,
      file_size,
      uploaded_by
    )
    SELECT
      v_subdemand_id,
      dra.file_name,
      dra.file_path,
      dra.file_type,
      dra.file_size,
      v_user_id
    FROM public.demand_request_attachments dra
    WHERE dra.demand_request_id = p_request_id
      AND dra.comment_id IS NULL
      AND dra.subdemand_index = v_sub_index;

    v_sub_index := v_sub_index + 1;
  END LOOP;

  v_sub_index := 0;
  FOR v_sub IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(v_request.subdemands_plan, '[]'::jsonb)) AS s(value)
  LOOP
    IF jsonb_typeof(v_sub->'dependsOnIndex') = 'number' THEN
      v_depends_on_index := (v_sub->>'dependsOnIndex')::integer;
      v_dep_index := v_sub_index + 1;

      IF v_depends_on_index >= 0
         AND v_depends_on_index < v_sub_index
         AND v_subdemand_ids[v_dep_index] IS NOT NULL
         AND v_subdemand_ids[v_depends_on_index + 1] IS NOT NULL THEN
        INSERT INTO public.demand_dependencies (demand_id, depends_on_demand_id)
        VALUES (v_subdemand_ids[v_dep_index], v_subdemand_ids[v_depends_on_index + 1])
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    v_sub_index := v_sub_index + 1;
  END LOOP;

  UPDATE public.demand_requests
  SET status = 'approved',
      rejection_reason = NULL,
      responded_by = v_user_id,
      responded_at = now(),
      approved_demand_id = v_parent_demand_id,
      updated_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'parent_id', v_parent_demand_id,
    'subdemand_ids', to_jsonb(v_subdemand_ids),
    'already_approved', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_demand_request(uuid, uuid[], timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_demand_request(uuid, uuid[], timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.approve_demand_request(uuid, uuid[], timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_demand_request(uuid, uuid[], timestamptz) TO service_role;

ALTER POLICY "Board approvers can update requests"
ON public.demand_requests
USING (
  public.is_team_admin_or_moderator(auth.uid(), team_id)
  OR (board_id IS NOT NULL AND public.is_board_admin_or_moderator(auth.uid(), board_id))
)
WITH CHECK (
  public.is_team_admin_or_moderator(auth.uid(), team_id)
  OR (board_id IS NOT NULL AND public.is_board_admin_or_moderator(auth.uid(), board_id))
);

ALTER POLICY "Users can update their own pending/returned requests"
ON public.demand_requests
USING (
  auth.uid() = created_by
  AND status = ANY (ARRAY['pending'::text, 'returned'::text])
)
WITH CHECK (
  auth.uid() = created_by
  AND status = ANY (ARRAY['pending'::text, 'returned'::text])
);