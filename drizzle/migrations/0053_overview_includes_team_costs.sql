CREATE OR REPLACE FUNCTION public._finance_overview_all(_team_id uuid, _from date, _to date)
 RETURNS TABLE(board_id uuid, board_name text, competence date, gross numeric, tax numeric, direct_expenses numeric, allocated_expenses numeric, team_cost numeric, hours_realized numeric, hours_planned numeric, hours_without_cost numeric, margin_target numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH months AS (SELECT generate_series(date_trunc('month', _from)::date, date_trunc('month', _to)::date, interval '1 month')::date AS m),
  bs AS (SELECT b.id, b.name FROM public.boards b WHERE b.team_id = _team_id),
  team_cfg AS (SELECT tax_rate, margin_target FROM public.finance_settings WHERE team_id = _team_id AND board_id IS NULL),
  pbm AS (
    SELECT DISTINCT pb.project_id, pb.board_id, months.m FROM months
    JOIN public.project_boards pb ON pb.team_id = _team_id AND pb.valid_from <= (months.m + interval '1 month - 1 day')::date
      AND (pb.valid_to IS NULL OR pb.valid_to >= months.m)
  ),
  pbn AS (SELECT project_id, m, count(*) n FROM pbm GROUP BY 1, 2),
  rev0 AS (
    SELECT r.board_id, date_trunc('month', r.competence)::date m, r.gross_amount gross,
      r.gross_amount * COALESCE(r.tax_rate, bc.tax_rate, (SELECT tax_rate FROM team_cfg), 0.21) tax
    FROM public.finance_revenues r
    LEFT JOIN public.finance_settings bc ON bc.team_id = r.team_id AND bc.board_id = r.board_id
    WHERE r.team_id = _team_id AND r.project_id IS NULL AND r.board_id IN (SELECT id FROM bs)
      AND r.competence BETWEEN date_trunc('month', _from)::date AND _to
    UNION ALL
    SELECT pbm.board_id, pbm.m, r.gross_amount / pbn.n, r.gross_amount / pbn.n * tr.tax_rate
    FROM public.finance_revenues r
    JOIN pbm ON pbm.project_id = r.project_id AND pbm.m = date_trunc('month', r.competence)::date
    JOIN pbn ON pbn.project_id = r.project_id AND pbn.m = pbm.m
    CROSS JOIN LATERAL public._finance_team_rates(_team_id, pbm.m) tr
    WHERE r.team_id = _team_id AND r.project_id IS NOT NULL
      AND r.competence BETWEEN date_trunc('month', _from)::date AND _to
  ),
  rev AS (SELECT board_id, m, sum(gross) gross, sum(tax) tax FROM rev0 GROUP BY 1, 2),
  exp AS (
    SELECT e.board_id, date_trunc('month', e.competence)::date m, sum(e.amount) amt
    FROM public.finance_expenses e
    WHERE e.team_id = _team_id AND e.board_id IN (SELECT id FROM bs) AND e.competence BETWEEN date_trunc('month', _from)::date AND _to
    GROUP BY 1, 2
  ),
  share AS (
    SELECT months.m, public._finance_team_cost_share(_team_id, months.m) s FROM months
  ),
  tc AS (
    SELECT pbm.board_id, sh.m,
      sum(((sh.s->>'fixa')::numeric + (sh.s->>'operacional')::numeric + (sh.s->>'administrativa')::numeric)
          / (sh.s->>'active_projects')::int / pbn.n) amt
    FROM share sh
    CROSS JOIN LATERAL jsonb_array_elements(sh.s->'projects') pr
    JOIN pbm ON pbm.project_id = (pr->>'id')::uuid AND pbm.m = sh.m
    JOIN pbn ON pbn.project_id = pbm.project_id AND pbn.m = sh.m
    WHERE (sh.s->>'configured')::boolean AND (sh.s->>'active_projects')::int > 0
    GROUP BY 1, 2
  ),
  alloc0 AS (
    SELECT a.board_id, a.competence m, sum(a.amount) amt FROM public._finance_allocations(_team_id, _from, _to) a
    WHERE NOT EXISTS (SELECT 1 FROM share sh WHERE sh.m = a.competence AND (sh.s->>'configured')::boolean)
    GROUP BY 1, 2
    UNION ALL SELECT board_id, m, amt FROM tc
  ),
  alloc AS (SELECT board_id, m, sum(amt) amt FROM alloc0 GROUP BY 1, 2),
  hrs AS (
    SELECT d.board_id, public._sp_month(t.started_at) m, t.user_id, sum(COALESCE(t.duration_seconds, 0)) / 3600.0 h
    FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id
    WHERE d.board_id IN (SELECT id FROM bs) AND t.started_at >= public._sp_month_start(_from) AND t.started_at < public._sp_month_start((date_trunc('month', _to) + interval '1 month')::date)
    GROUP BY 1, 2, 3
  ),
  cost AS (
    SELECT h.board_id, h.m, sum(h.h) h_total,
      sum(CASE WHEN mc.monthly_cost IS NOT NULL THEN h.h * mc.monthly_cost / mc.productive_hours ELSE 0 END) cost,
      sum(CASE WHEN mc.monthly_cost IS NULL THEN h.h ELSE 0 END) h_missing
    FROM hrs h LEFT JOIN LATERAL public._finance_member_cost(_team_id, h.user_id, h.m) mc ON true
    GROUP BY 1, 2
  ),
  plan AS (
    SELECT d.board_id, public._sp_month(d.created_at) m, sum(COALESCE(s.estimated_hours, s.hours_max, 0)) h
    FROM public.demands d JOIN public.services s ON s.id = d.service_id
    WHERE d.board_id IN (SELECT id FROM bs) AND d.archived = false
      AND d.created_at >= public._sp_month_start(_from) AND d.created_at < public._sp_month_start((date_trunc('month', _to) + interval '1 month')::date)
    GROUP BY 1, 2
  )
  SELECT bs.id, bs.name, months.m,
    COALESCE(rev.gross, 0), COALESCE(rev.tax, 0), COALESCE(exp.amt, 0), COALESCE(alloc.amt, 0),
    COALESCE(cost.cost, 0), COALESCE(cost.h_total, 0), COALESCE(plan.h, 0), COALESCE(cost.h_missing, 0),
    COALESCE((SELECT margin_target FROM public.finance_settings fs WHERE fs.team_id = _team_id AND fs.board_id = bs.id),
             (SELECT margin_target FROM team_cfg), 0.40)
  FROM bs CROSS JOIN months
  LEFT JOIN rev ON rev.board_id = bs.id AND rev.m = months.m
  LEFT JOIN exp ON exp.board_id = bs.id AND exp.m = months.m
  LEFT JOIN alloc ON alloc.board_id = bs.id AND alloc.m = months.m
  LEFT JOIN cost ON cost.board_id = bs.id AND cost.m = months.m
  LEFT JOIN plan ON plan.board_id = bs.id AND plan.m = months.m
$function$;