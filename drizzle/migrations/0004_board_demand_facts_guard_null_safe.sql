-- Torna a verificação de acesso de board_demand_facts à prova de NULL:
-- sem claims JWT (papel nulo) a expressão anterior avaliava NULL e não bloqueava.
CREATE OR REPLACE FUNCTION public.board_demand_facts(
  p_board_id uuid,
  p_tz text DEFAULT 'America/Fortaleza'
)
RETURNS TABLE (
  id uuid,
  board_sequence_number integer,
  code text,
  title text,
  priority text,
  stage_name text,
  stage_position integer,
  stage_color text,
  is_delivered boolean,
  delivered_estimated boolean,
  delivered_at timestamptz,
  delivered_on date,
  delivery_state text,
  due_on date,
  has_due boolean,
  is_overdue_now boolean,
  days_overdue integer,
  days_late integer,
  due_in_days integer,
  is_due_soon boolean,
  created_at timestamptz,
  created_on date,
  delivery_days integer,
  age_days integer,
  responsible_id uuid,
  responsible_name text,
  follower_names text[],
  assignee_ids uuid[],
  service_id uuid,
  service_name text,
  created_by uuid,
  created_by_name text,
  is_subdemand boolean,
  parent_demand_id uuid,
  is_backlog boolean,
  is_adjustment boolean,
  is_requests_stage boolean,
  effort_points integer,
  reschedule_count integer,
  time_seconds bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE p_tz)::date;
  v_role text := coalesce(
    current_setting('request.jwt.claim.role', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  );
  v_allowed boolean;
BEGIN
  IF p_board_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION: board_id obrigatório' USING ERRCODE = '22023';
  END IF;

  v_allowed := coalesce(v_role = 'service_role', false)
    OR (current_user IN ('postgres', 'supabase_admin'))
    OR (auth.uid() IS NOT NULL AND (
          coalesce(public.is_board_member(auth.uid(), p_board_id), false)
          OR coalesce(public.is_team_admin_or_moderator_for_board(auth.uid(), p_board_id), false)
       ));

  IF NOT coalesce(v_allowed, false) THEN
    RAISE EXCEPTION 'PERMISSION_DENIED: você não tem acesso a este quadro' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH d AS (
    SELECT
      dm.id, dm.board_sequence_number, dm.title, dm.priority, dm.status_id,
      dm.due_date, dm.delivered_at, dm.status_changed_at, dm.updated_at, dm.created_at,
      dm.assigned_to, dm.service_id, dm.created_by, dm.parent_demand_id, dm.effort_points,
      st.name  AS status_name,
      st.color AS status_color,
      bs.position AS stage_position
    FROM public.demands dm
    LEFT JOIN public.demand_statuses st ON st.id = dm.status_id
    LEFT JOIN public.board_statuses  bs ON bs.board_id = dm.board_id AND bs.status_id = dm.status_id
    WHERE dm.board_id = p_board_id
      AND dm.archived = false
  ),
  base AS (
    SELECT
      d.*,
      (lower(coalesce(d.status_name, '')) LIKE '%entregue%'
        OR lower(coalesce(d.status_name, '')) LIKE '%conclu%')            AS in_delivered_stage,
      (d.due_date AT TIME ZONE 'UTC')::date                                  AS due_on_v,
      (d.created_at AT TIME ZONE p_tz)::date                                 AS created_on_v
    FROM d
  ),
  norm AS (
    SELECT
      b.*,
      (b.delivered_at IS NOT NULL OR b.in_delivered_stage)                   AS is_delivered_v,
      (b.delivered_at IS NULL AND b.in_delivered_stage)                      AS delivered_estimated_v,
      coalesce(
        b.delivered_at,
        CASE WHEN b.in_delivered_stage THEN coalesce(b.status_changed_at, b.updated_at) END
      )                                                                      AS delivered_ts_v
    FROM base b
  ),
  facts AS (
    SELECT
      n.*,
      (n.delivered_ts_v AT TIME ZONE p_tz)::date                             AS delivered_on_v,
      CASE
        WHEN NOT n.is_delivered_v THEN 'open'
        WHEN n.due_on_v IS NULL THEN 'delivered_no_due'
        WHEN (n.delivered_ts_v AT TIME ZONE p_tz)::date <= n.due_on_v THEN 'delivered_on_time'
        ELSE 'delivered_late'
      END                                                                    AS delivery_state_v
    FROM norm n
  ),
  people AS (
    SELECT
      f.id AS demand_id,
      (SELECT da.user_id
         FROM public.demand_assignees da
        WHERE da.demand_id = f.id
        ORDER BY da.is_primary DESC, da.assigned_at ASC NULLS LAST
        LIMIT 1)                                                             AS primary_user_id,
      (SELECT coalesce(array_agg(da.user_id), '{}'::uuid[])
         FROM public.demand_assignees da
        WHERE da.demand_id = f.id)                                           AS all_ids
    FROM facts f
  )
  SELECT
    f.id,
    f.board_sequence_number,
    CASE WHEN f.board_sequence_number IS NULL THEN '—'
         ELSE '#' || lpad(f.board_sequence_number::text, 4, '0') END           AS code,
    f.title,
    CASE lower(trim(coalesce(f.priority, 'média')))
      WHEN 'media'  THEN 'média'
      WHEN 'medium' THEN 'média'
      WHEN 'low'    THEN 'baixa'
      WHEN 'high'   THEN 'alta'
      WHEN 'urgent' THEN 'urgente'
      ELSE lower(trim(coalesce(f.priority, 'média')))
    END                                                                        AS priority,
    coalesce(f.status_name, 'Sem etapa')                                       AS stage_name,
    f.stage_position,
    f.status_color                                                             AS stage_color,
    f.is_delivered_v                                                           AS is_delivered,
    f.delivered_estimated_v                                                    AS delivered_estimated,
    f.delivered_ts_v                                                           AS delivered_at,
    f.delivered_on_v                                                           AS delivered_on,
    f.delivery_state_v                                                         AS delivery_state,
    f.due_on_v                                                                 AS due_on,
    (f.due_on_v IS NOT NULL)                                                   AS has_due,
    (NOT f.is_delivered_v AND f.due_on_v IS NOT NULL AND f.due_on_v < v_today) AS is_overdue_now,
    CASE WHEN NOT f.is_delivered_v AND f.due_on_v IS NOT NULL AND f.due_on_v < v_today
         THEN (v_today - f.due_on_v) ELSE 0 END                                AS days_overdue,
    CASE WHEN f.delivery_state_v = 'delivered_late'
         THEN (f.delivered_on_v - f.due_on_v) ELSE 0 END                       AS days_late,
    CASE WHEN NOT f.is_delivered_v AND f.due_on_v IS NOT NULL
         THEN (f.due_on_v - v_today) END                                       AS due_in_days,
    (NOT f.is_delivered_v AND f.due_on_v IS NOT NULL
      AND f.due_on_v >= v_today AND f.due_on_v <= v_today + 7)                 AS is_due_soon,
    f.created_at,
    f.created_on_v                                                             AS created_on,
    CASE WHEN f.is_delivered_v AND f.delivered_on_v IS NOT NULL
         THEN greatest(f.delivered_on_v - f.created_on_v, 0) END               AS delivery_days,
    (v_today - f.created_on_v)                                                 AS age_days,
    coalesce(p.primary_user_id, f.assigned_to)                                 AS responsible_id,
    coalesce(
      (SELECT pr.full_name FROM public.profiles pr WHERE pr.id = coalesce(p.primary_user_id, f.assigned_to)),
      CASE WHEN coalesce(p.primary_user_id, f.assigned_to) IS NULL THEN NULL ELSE 'Sem nome' END
    )                                                                          AS responsible_name,
    coalesce((
      SELECT array_agg(coalesce(pr.full_name, 'Sem nome') ORDER BY pr.full_name)
        FROM unnest(p.all_ids) AS u(uid)
        LEFT JOIN public.profiles pr ON pr.id = u.uid
       WHERE u.uid IS DISTINCT FROM coalesce(p.primary_user_id, f.assigned_to)
    ), '{}'::text[])                                                           AS follower_names,
    CASE WHEN p.all_ids = '{}'::uuid[] AND f.assigned_to IS NOT NULL
         THEN ARRAY[f.assigned_to] ELSE p.all_ids END                          AS assignee_ids,
    f.service_id,
    (SELECT s.name FROM public.services s WHERE s.id = f.service_id)           AS service_name,
    f.created_by,
    (SELECT pr.full_name FROM public.profiles pr WHERE pr.id = f.created_by)   AS created_by_name,
    (f.parent_demand_id IS NOT NULL)                                           AS is_subdemand,
    f.parent_demand_id,
    (lower(coalesce(f.status_name, '')) = 'backlog')                           AS is_backlog,
    (lower(coalesce(f.status_name, '')) IN ('em ajuste', 'ajuste'))            AS is_adjustment,
    (lower(coalesce(f.status_name, '')) IN ('solicitações', 'solicitacoes'))   AS is_requests_stage,
    f.effort_points,
    (SELECT count(*)::integer FROM public.demand_due_date_changes c WHERE c.demand_id = f.id) AS reschedule_count,
    (SELECT coalesce(sum(t.duration_seconds), 0)::bigint
       FROM public.demand_time_entries t WHERE t.demand_id = f.id)             AS time_seconds
  FROM facts f
  JOIN people p ON p.demand_id = f.id
  ORDER BY f.stage_position NULLS LAST, f.due_on_v NULLS LAST, f.created_at;
END;
$$;