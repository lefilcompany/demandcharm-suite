-- =============================================================================
-- Módulo de métricas do quadro (fonte única de verdade)
--
-- board_demand_facts(board_id): uma linha por demanda ativa do quadro com todas
-- as definições canônicas já resolvidas (aberta, entregue no prazo/atrasada,
-- vencida, vence em breve, etapa, responsável, serviço...).
--
-- get_board_metrics(board_id, from, to, member_id): agregados prontos para o
-- assistente do quadro, MCP e UI, calculados SOMENTE a partir de board_demand_facts.
--
-- Convenções de data:
--   * due_date é um campo "só data": usa-se a parte de data em UTC (igual ao
--     substring(0,10) do frontend), evitando deslocamento de fuso.
--   * created_at / delivered_at são instantes reais: convertidos para p_tz.
--   * "hoje" = data atual em p_tz (padrão America/Fortaleza).
-- =============================================================================

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
BEGIN
  IF p_board_id IS NULL THEN
    RAISE EXCEPTION 'VALIDATION: board_id obrigatório' USING ERRCODE = '22023';
  END IF;

  IF NOT (
    v_role = 'service_role'
    OR public.is_board_member(auth.uid(), p_board_id)
    OR public.is_team_admin_or_moderator_for_board(auth.uid(), p_board_id)
  ) THEN
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

REVOKE ALL ON FUNCTION public.board_demand_facts(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.board_demand_facts(uuid, text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_board_metrics(
  p_board_id uuid,
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_member_id uuid DEFAULT NULL,
  p_tz text DEFAULT 'America/Fortaleza'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE p_tz)::date;
  v_from_ts timestamptz := CASE WHEN p_from IS NULL THEN NULL ELSE (p_from::timestamp AT TIME ZONE p_tz) END;
  v_to_ts   timestamptz := CASE WHEN p_to   IS NULL THEN NULL ELSE ((p_to + 1)::timestamp AT TIME ZONE p_tz) END;
  v_month_start date := date_trunc('month', v_today)::date;
  v_board record;
  v_member_name text;
  v_result jsonb;
BEGIN
  SELECT b.id, b.name, b.description, b.monthly_demand_limit, b.team_id
    INTO v_board
    FROM public.boards b
   WHERE b.id = p_board_id;

  IF v_board.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: quadro não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF p_member_id IS NOT NULL THEN
    SELECT full_name INTO v_member_name FROM public.profiles WHERE id = p_member_id;
  END IF;

  -- board_demand_facts já valida o acesso do usuário ao quadro.
  WITH f AS MATERIALIZED (
    SELECT *
      FROM public.board_demand_facts(p_board_id, p_tz) x
     WHERE p_member_id IS NULL OR p_member_id = ANY (x.assignee_ids)
  ),
  in_period AS (
    SELECT * FROM f
     WHERE (v_from_ts IS NULL OR f.created_at >= v_from_ts)
       AND (v_to_ts   IS NULL OR f.created_at <  v_to_ts)
  ),
  delivered_in_period AS (
    SELECT * FROM f
     WHERE f.is_delivered
       AND (p_from IS NULL OR f.delivered_on >= p_from)
       AND (p_to   IS NULL OR f.delivered_on <= p_to)
  ),
  stages AS (
    SELECT bs.position, st.name, st.color, st.id AS status_id
      FROM public.board_statuses bs
      JOIN public.demand_statuses st ON st.id = bs.status_id
     WHERE bs.board_id = p_board_id AND bs.is_active = true
  ),
  by_stage AS (
    SELECT jsonb_agg(jsonb_build_object(
             'name', s.name,
             'position', s.position,
             'color', s.color,
             'count', coalesce(c.cnt, 0),
             'overdue', coalesce(c.ovd, 0)
           ) ORDER BY s.position) AS j
      FROM stages s
      LEFT JOIN (
        SELECT stage_name, count(*) AS cnt, count(*) FILTER (WHERE is_overdue_now) AS ovd
          FROM f GROUP BY stage_name
      ) c ON c.stage_name = s.name
  ),
  by_priority AS (
    SELECT jsonb_agg(jsonb_build_object(
             'priority', priority,
             'total', total,
             'open', open_cnt,
             'overdue', ovd
           ) ORDER BY CASE priority WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'média' THEN 2 ELSE 3 END) AS j
      FROM (
        SELECT priority,
               count(*) AS total,
               count(*) FILTER (WHERE NOT is_delivered) AS open_cnt,
               count(*) FILTER (WHERE is_overdue_now) AS ovd
          FROM f GROUP BY priority
      ) t
  ),
  by_service AS (
    SELECT jsonb_agg(jsonb_build_object(
             'service', service,
             'total', total,
             'open', open_cnt,
             'overdue', ovd,
             'delivered', dlv
           ) ORDER BY total DESC, service) AS j
      FROM (
        SELECT coalesce(service_name, 'Sem serviço') AS service,
               count(*) AS total,
               count(*) FILTER (WHERE NOT is_delivered) AS open_cnt,
               count(*) FILTER (WHERE is_overdue_now) AS ovd,
               count(*) FILTER (WHERE is_delivered) AS dlv
          FROM f GROUP BY coalesce(service_name, 'Sem serviço')
      ) t
  ),
  by_responsible AS (
    SELECT jsonb_agg(jsonb_build_object(
             'user_id', responsible_id,
             'name', name,
             'total', total,
             'open', open_cnt,
             'overdue', ovd,
             'due_soon', soon,
             'delivered', dlv,
             'delivered_late', dlv_late,
             'delivered_on_time', dlv_ok,
             'time_hours', round(secs / 3600.0, 1)
           ) ORDER BY ovd DESC, open_cnt DESC, name) AS j
      FROM (
        SELECT responsible_id,
               coalesce(responsible_name, 'Sem responsável') AS name,
               count(*) AS total,
               count(*) FILTER (WHERE NOT is_delivered) AS open_cnt,
               count(*) FILTER (WHERE is_overdue_now) AS ovd,
               count(*) FILTER (WHERE is_due_soon) AS soon,
               count(*) FILTER (WHERE is_delivered) AS dlv,
               count(*) FILTER (WHERE delivery_state = 'delivered_late') AS dlv_late,
               count(*) FILTER (WHERE delivery_state = 'delivered_on_time') AS dlv_ok,
               coalesce(sum(time_seconds), 0) AS secs
          FROM f GROUP BY responsible_id, coalesce(responsible_name, 'Sem responsável')
      ) t
  ),
  reqs AS (
    SELECT count(*) AS created,
           count(*) FILTER (WHERE status = 'pending')  AS pending,
           count(*) FILTER (WHERE status = 'approved') AS approved,
           count(*) FILTER (WHERE status = 'rejected') AS rejected,
           count(*) FILTER (WHERE status = 'returned') AS returned
      FROM public.demand_requests r
     WHERE r.board_id = p_board_id
       AND (p_member_id IS NULL OR r.created_by = p_member_id)
       AND (v_from_ts IS NULL OR r.created_at >= v_from_ts)
       AND (v_to_ts   IS NULL OR r.created_at <  v_to_ts)
  ),
  reqs_pending_total AS (
    SELECT count(*) AS pending_now
      FROM public.demand_requests r
     WHERE r.board_id = p_board_id AND r.status = 'pending'
  ),
  time_in_period AS (
    SELECT coalesce(sum(t.duration_seconds), 0) AS secs
      FROM public.demand_time_entries t
      JOIN public.demands dm ON dm.id = t.demand_id
     WHERE dm.board_id = p_board_id
       AND dm.archived = false
       AND (p_member_id IS NULL OR t.user_id = p_member_id)
       AND (v_from_ts IS NULL OR t.started_at >= v_from_ts)
       AND (v_to_ts   IS NULL OR t.started_at <  v_to_ts)
  ),
  month_usage AS (
    SELECT count(*) AS used
      FROM public.demands dm
     WHERE dm.board_id = p_board_id
       AND dm.archived = false
       AND (dm.created_at AT TIME ZONE p_tz)::date >= v_month_start
  ),
  cur AS (
    SELECT
      count(*)                                                  AS active_total,
      count(*) FILTER (WHERE NOT is_delivered)                  AS open_cnt,
      count(*) FILTER (WHERE is_delivered)                      AS delivered_total,
      count(*) FILTER (WHERE is_overdue_now)                    AS overdue,
      count(*) FILTER (WHERE is_due_soon)                       AS due_soon,
      count(*) FILTER (WHERE NOT is_delivered AND due_in_days = 0) AS due_today,
      count(*) FILTER (WHERE NOT is_delivered AND NOT has_due)  AS no_due,
      count(*) FILTER (WHERE NOT is_delivered AND responsible_id IS NULL) AS unassigned,
      count(*) FILTER (WHERE is_backlog)                        AS backlog,
      count(*) FILTER (WHERE is_adjustment)                     AS in_adjustment,
      count(*) FILTER (WHERE is_requests_stage)                 AS in_requests_stage,
      count(*) FILTER (WHERE NOT is_delivered AND is_subdemand) AS subdemands_open,
      count(*) FILTER (WHERE NOT is_delivered AND priority IN ('alta','urgente')) AS open_high_priority,
      round(avg(days_overdue) FILTER (WHERE is_overdue_now), 1) AS avg_days_overdue,
      max(days_overdue)                                         AS max_days_overdue,
      max(age_days) FILTER (WHERE NOT is_delivered)             AS oldest_open_days,
      round(avg(age_days) FILTER (WHERE NOT is_delivered), 1)   AS avg_age_open_days,
      count(*) FILTER (WHERE NOT is_delivered AND reschedule_count > 0) AS open_rescheduled,
      coalesce(sum(reschedule_count), 0)                        AS total_reschedules
    FROM f
  ),
  flow AS (
    SELECT
      (SELECT count(*) FROM in_period)                                        AS created,
      (SELECT count(*) FROM in_period WHERE is_subdemand)                     AS created_subdemands,
      (SELECT count(*) FROM delivered_in_period)                              AS delivered,
      (SELECT count(*) FROM delivered_in_period WHERE delivery_state = 'delivered_on_time') AS on_time,
      (SELECT count(*) FROM delivered_in_period WHERE delivery_state = 'delivered_late')    AS late,
      (SELECT count(*) FROM delivered_in_period WHERE delivery_state = 'delivered_no_due')  AS no_due,
      (SELECT count(*) FROM delivered_in_period WHERE delivered_estimated)    AS delivered_estimated,
      (SELECT round(avg(delivery_days), 1) FROM delivered_in_period)          AS avg_delivery_days,
      (SELECT round(avg(days_late), 1) FROM delivered_in_period WHERE delivery_state = 'delivered_late') AS avg_days_late,
      (SELECT max(days_late) FROM delivered_in_period)                        AS max_days_late
  )
  SELECT jsonb_build_object(
    'board', jsonb_build_object(
      'id', v_board.id,
      'name', v_board.name,
      'description', v_board.description,
      'team_id', v_board.team_id
    ),
    'generated_at', now(),
    'timezone', p_tz,
    'today', v_today,
    'scope', jsonb_build_object('member_id', p_member_id, 'member_name', v_member_name),
    'period', CASE WHEN p_from IS NULL AND p_to IS NULL THEN NULL
                   ELSE jsonb_build_object('from', p_from, 'to', p_to) END,
    'definitions', jsonb_build_object(
      'open', 'Demanda ativa (não arquivada) que ainda não está na etapa Entregue.',
      'delivered', 'Demanda na etapa Entregue (ou com data de entrega registrada).',
      'delivered_on_time', 'Entregue com data de entrega <= prazo.',
      'delivered_late', 'Entregue depois do prazo.',
      'overdue', 'Aberta com prazo anterior a hoje (vencida).',
      'due_soon', 'Aberta com prazo entre hoje e os próximos 7 dias.',
      'current', 'Estado atual do quadro (não depende do período).',
      'period_flow', 'Fluxo dentro do período: criadas, entregues e solicitações. Sem período = histórico completo.'
    ),
    'current', (SELECT jsonb_build_object(
      'active_total', c.active_total,
      'open', c.open_cnt,
      'delivered_total', c.delivered_total,
      'overdue', c.overdue,
      'due_soon_7d', c.due_soon,
      'due_today', c.due_today,
      'no_due_date', c.no_due,
      'unassigned', c.unassigned,
      'backlog', c.backlog,
      'in_adjustment', c.in_adjustment,
      'in_requests_stage', c.in_requests_stage,
      'subdemands_open', c.subdemands_open,
      'open_high_priority', c.open_high_priority,
      'avg_days_overdue', c.avg_days_overdue,
      'max_days_overdue', c.max_days_overdue,
      'oldest_open_days', c.oldest_open_days,
      'avg_age_open_days', c.avg_age_open_days,
      'open_rescheduled', c.open_rescheduled,
      'total_reschedules', c.total_reschedules,
      'by_stage', coalesce((SELECT j FROM by_stage), '[]'::jsonb),
      'by_priority', coalesce((SELECT j FROM by_priority), '[]'::jsonb),
      'by_service', coalesce((SELECT j FROM by_service), '[]'::jsonb),
      'by_responsible', coalesce((SELECT j FROM by_responsible), '[]'::jsonb)
    ) FROM cur c),
    'period_flow', (SELECT jsonb_build_object(
      'created', fl.created,
      'created_subdemands', fl.created_subdemands,
      'delivered', fl.delivered,
      'delivered_on_time', fl.on_time,
      'delivered_late', fl.late,
      'delivered_no_due_date', fl.no_due,
      'delivered_estimated_date', fl.delivered_estimated,
      'on_time_rate', CASE WHEN (fl.on_time + fl.late) > 0
                           THEN round(100.0 * fl.on_time / (fl.on_time + fl.late)) ELSE NULL END,
      'avg_delivery_days', fl.avg_delivery_days,
      'avg_days_late', fl.avg_days_late,
      'max_days_late', fl.max_days_late,
      'requests', (SELECT jsonb_build_object(
          'created', r.created, 'pending', r.pending, 'approved', r.approved,
          'rejected', r.rejected, 'returned', r.returned,
          'pending_now', (SELECT pending_now FROM reqs_pending_total)
        ) FROM reqs r),
      'time_hours_logged', (SELECT round(secs / 3600.0, 1) FROM time_in_period)
    ) FROM flow fl),
    'monthly_limit', jsonb_build_object(
      'limit', v_board.monthly_demand_limit,
      'used_this_month', (SELECT used FROM month_usage),
      'remaining', CASE WHEN coalesce(v_board.monthly_demand_limit, 0) > 0
                        THEN greatest(v_board.monthly_demand_limit - (SELECT used FROM month_usage), 0)
                        ELSE NULL END,
      'month_start', v_month_start
    )
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_board_metrics(uuid, date, date, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_board_metrics(uuid, date, date, uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.board_demand_facts(uuid, text) IS
  'Fatos canônicos por demanda de um quadro (aberta/entregue/vencida/prazo/etapa/responsável). Fonte única das definições de métricas.';
COMMENT ON FUNCTION public.get_board_metrics(uuid, date, date, uuid, text) IS
  'Agregados do quadro calculados a partir de board_demand_facts: estado atual, fluxo no período, solicitações e limite mensal.';