CREATE OR REPLACE FUNCTION public.get_project_hours_costs(_project_id uuid, _competence date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := (select auth.uid());
  _team uuid; _detail boolean; _comp date := date_trunc('month', _competence)::date;
  _people jsonb; _audit jsonb; _summary jsonb; _expenses jsonb; _pending numeric;
BEGIN
  SELECT team_id INTO _team FROM projects WHERE id = _project_id;
  IF _team IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT (public.can_read_finance_structure(_uid, _team)
          OR public.has_finance_permission(_uid, 'finance.view_project', _team, NULL)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  _detail := public.has_finance_permission(_uid, 'finance.view_employee_costs', _team, NULL);

  CREATE TEMP TABLE IF NOT EXISTS _phc (user_id uuid, demand_id uuid, hours numeric, raw_hours numeric, is_split boolean, is_running boolean, overlapped boolean, project_id uuid, status text) ON COMMIT DROP;
  TRUNCATE _phc;
  INSERT INTO _phc
  SELECT s.user_id, s.demand_id, s.hours, s.raw_hours, s.is_split, s.is_running, s.overlapped, a.project_id, coalesce(a.status, 'pending')
  FROM public._finance_time_slices(_team, _comp) s
  LEFT JOIN finance_demand_attributions a ON a.demand_id = s.demand_id AND a.competence = _comp;

  SELECT coalesce(sum(hours), 0) INTO _pending FROM _phc WHERE project_id IS NULL;

  WITH per AS (
    SELECT h.user_id, sum(h.hours) AS hours FROM _phc h WHERE h.project_id = _project_id GROUP BY h.user_id
  ), j AS (
    SELECT per.user_id, per.hours, p.full_name,
      (SELECT mp.kind FROM finance_member_profiles mp WHERE mp.team_id = _team AND mp.user_id = per.user_id
         AND mp.valid_from <= (_comp + interval '1 month - 1 day')::date AND (mp.valid_to IS NULL OR mp.valid_to >= _comp)
         ORDER BY mp.valid_from DESC LIMIT 1) AS kind,
      (SELECT CASE WHEN x.productive_hours > 0 THEN x.monthly_cost / x.productive_hours END
         FROM public._finance_member_cost(_team, per.user_id, _comp) x LIMIT 1) AS hourly
    FROM per LEFT JOIN profiles p ON p.id = per.user_id
  )
  SELECT
    jsonb_build_object(
      'internal_hours', coalesce(sum(hours) FILTER (WHERE kind = 'internal'), 0),
      'client_external_hours', coalesce(sum(hours) FILTER (WHERE kind = 'client_external'), 0),
      'contractor_hours', coalesce(sum(hours) FILTER (WHERE kind = 'contractor'), 0),
      'unclassified_hours', coalesce(sum(hours) FILTER (WHERE kind IS NULL), 0),
      'personnel_cost', round(coalesce(sum(hours * hourly), 0), 2),
      'missing_cost_people', count(*) FILTER (WHERE hourly IS NULL),
      'missing_cost_hours', coalesce(sum(hours) FILTER (WHERE hourly IS NULL), 0),
      'people_count', count(*),
      'pending_hours', _pending),
    CASE WHEN _detail THEN coalesce(jsonb_agg(jsonb_build_object(
      'user_id', user_id, 'name', coalesce(full_name, 'Sem nome'), 'kind', kind, 'hours', round(hours, 2),
      'hourly_cost', round(hourly, 2), 'cost', CASE WHEN hourly IS NULL THEN NULL ELSE round(hours * hourly, 2) END
    ) ORDER BY hours DESC), '[]'::jsonb) ELSE NULL END
  INTO _summary, _people FROM j;

  SELECT jsonb_build_object(
    'overlap_entries', count(*) FILTER (WHERE overlapped),
    'overlap_hours_removed', round(coalesce(sum(raw_hours - hours) FILTER (WHERE overlapped), 0), 2),
    'split_entries', count(*) FILTER (WHERE is_split),
    'running_entries', count(*) FILTER (WHERE is_running))
  INTO _audit FROM _phc WHERE project_id = _project_id;

  WITH pb AS (
    SELECT board_id FROM project_boards WHERE project_id = _project_id
      AND valid_from <= (_comp + interval '1 month - 1 day')::date AND (valid_to IS NULL OR valid_to >= _comp)
  ), direct AS (
    SELECT coalesce(sum(amount), 0) v FROM finance_expenses WHERE team_id = _team AND competence = _comp AND board_id IN (SELECT board_id FROM pb)
  ), sh AS (
    SELECT public._finance_team_cost_share(_team, _comp) s
  ), tcs AS (
    SELECT t.k expense_type, CASE WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(sh.s->'projects') x WHERE (x->>'id')::uuid = _project_id)
      THEN (sh.s->>t.k)::numeric / nullif((sh.s->>'active_projects')::int, 0) ELSE 0 END v
    FROM sh, (VALUES ('fixa'),('operacional'),('administrativa')) t(k) WHERE (sh.s->>'configured')::boolean
  ), shared AS (
    SELECT e.expense_type, sum(al.amount) v
    FROM public._finance_allocations(_team, _comp, _comp) al JOIN finance_expenses e ON e.id = al.expense_id
    WHERE al.board_id IN (SELECT board_id FROM pb) AND NOT EXISTS (SELECT 1 FROM tcs) GROUP BY e.expense_type
    UNION ALL SELECT expense_type, v FROM tcs
  ), unalloc AS (
    SELECT coalesce(sum(e.amount - coalesce((SELECT sum(al.amount) FROM public._finance_allocations(_team, _comp, _comp) al WHERE al.expense_id = e.id), 0)), 0) v
    FROM finance_expenses e WHERE e.team_id = _team AND e.competence = _comp AND e.board_id IS NULL AND NOT EXISTS (SELECT 1 FROM tcs)
  )
  SELECT jsonb_build_object(
    'direct', (SELECT v FROM direct),
    'fixa', coalesce((SELECT v FROM shared WHERE expense_type = 'fixa'), 0),
    'operacional', coalesce((SELECT v FROM shared WHERE expense_type = 'operacional'), 0),
    'administrativa', coalesce((SELECT v FROM shared WHERE expense_type = 'administrativa'), 0),
    'team_unallocated', round((SELECT v FROM unalloc), 2))
  INTO _expenses;

  RETURN jsonb_build_object('competence', _comp, 'can_see_people', _detail, 'summary', _summary,
    'people', _people, 'audit', _audit, 'expenses', _expenses);
END $function$;