ALTER TABLE public.finance_expenses ALTER COLUMN board_id DROP NOT NULL;
ALTER TABLE public.finance_expenses
  ADD COLUMN IF NOT EXISTS expense_type text NOT NULL DEFAULT 'operacional',
  ADD COLUMN IF NOT EXISTS allocation_method text,
  ADD COLUMN IF NOT EXISTS hours_weight numeric,
  ADD COLUMN IF NOT EXISTS allocation_board_ids uuid[];
ALTER TABLE public.finance_expenses
  ADD CONSTRAINT finance_expenses_type_chk CHECK (expense_type IN ('fixa','operacional','administrativa')),
  ADD CONSTRAINT finance_expenses_method_chk CHECK (allocation_method IS NULL OR allocation_method IN ('hours','revenue','mixed')),
  ADD CONSTRAINT finance_expenses_direct_or_shared_chk CHECK ((board_id IS NULL) = (allocation_method IS NOT NULL)),
  ADD CONSTRAINT finance_expenses_weight_chk CHECK (hours_weight IS NULL OR (hours_weight >= 0 AND hours_weight <= 1));

-- Shared-expense allocation over ALL team boards (shares never depend on the viewer). Internal only.
CREATE OR REPLACE FUNCTION public._finance_allocations(_team_id uuid, _from date, _to date)
RETURNS TABLE(expense_id uuid, competence date, board_id uuid, amount numeric, share numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH months AS (SELECT generate_series(date_trunc('month', _from)::date, date_trunc('month', _to)::date, interval '1 month')::date AS m),
  shared AS (
    SELECT e.id, date_trunc('month', e.competence)::date m, e.amount, e.allocation_board_ids,
      CASE e.allocation_method WHEN 'hours' THEN 1 WHEN 'revenue' THEN 0 ELSE COALESCE(e.hours_weight, 0.5) END w
    FROM public.finance_expenses e
    WHERE e.team_id = _team_id AND e.board_id IS NULL AND e.allocation_method IS NOT NULL
      AND e.competence BETWEEN date_trunc('month', _from)::date AND _to
  ),
  h AS (
    SELECT d.board_id, date_trunc('month', t.started_at)::date m, sum(COALESCE(t.duration_seconds,0))/3600.0 v
    FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id JOIN public.boards b ON b.id = d.board_id
    WHERE b.team_id = _team_id AND t.started_at >= date_trunc('month', _from) AND t.started_at < date_trunc('month', _to) + interval '1 month'
    GROUP BY 1,2
  ),
  r AS (
    SELECT fr.board_id, date_trunc('month', fr.competence)::date m, sum(fr.gross_amount) v
    FROM public.finance_revenues fr WHERE fr.team_id = _team_id
      AND fr.competence BETWEEN date_trunc('month', _from)::date AND _to GROUP BY 1,2
  ),
  base AS (
    SELECT b.id board_id, months.m, COALESCE(h.v,0) hrs, COALESCE(r.v,0) gross
    FROM public.boards b CROSS JOIN months
    LEFT JOIN h ON h.board_id = b.id AND h.m = months.m
    LEFT JOIN r ON r.board_id = b.id AND r.m = months.m
    WHERE b.team_id = _team_id
  ),
  elig AS (
    SELECT s.id, s.m, s.amount, s.w, b.board_id, b.hrs, b.gross,
      sum(b.hrs) OVER (PARTITION BY s.id) sh, sum(b.gross) OVER (PARTITION BY s.id) sg
    FROM shared s JOIN base b ON b.m = s.m AND (s.allocation_board_ids IS NULL OR b.board_id = ANY(s.allocation_board_ids))
  ),
  sh AS (
    SELECT *, (CASE WHEN sh > 0 THEN w*hrs/sh ELSE 0 END) + (CASE WHEN sg > 0 THEN (1-w)*gross/sg ELSE 0 END) sp FROM elig
  ),
  rd AS (
    SELECT id, m, board_id, sp, round(amount*sp, 2) a,
      round(amount * sum(sp) OVER (PARTITION BY id), 2) - sum(round(amount*sp, 2)) OVER (PARTITION BY id) resid,
      row_number() OVER (PARTITION BY id ORDER BY sp DESC, board_id) rn
    FROM sh
  )
  SELECT id, m, board_id, a + CASE WHEN rn = 1 THEN resid ELSE 0 END, sp FROM rd WHERE sp > 0
$$;
REVOKE ALL ON FUNCTION public._finance_allocations(uuid, date, date) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.get_finance_overview(uuid, date, date);
CREATE FUNCTION public.get_finance_overview(_team_id uuid, _from date, _to date)
 RETURNS TABLE(board_id uuid, board_name text, competence date, gross numeric, tax numeric, direct_expenses numeric, allocated_expenses numeric, team_cost numeric, hours_realized numeric, hours_planned numeric, hours_without_cost numeric, margin_target numeric)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() AS uid),
  months AS (SELECT generate_series(date_trunc('month', _from)::date, date_trunc('month', _to)::date, interval '1 month')::date AS m),
  bs AS (
    SELECT b.id, b.name FROM public.boards b, me
    WHERE b.team_id = _team_id AND public.can_view_finance_board(me.uid, _team_id, b.id)
  ),
  team_cfg AS (SELECT tax_rate, margin_target FROM public.finance_settings WHERE team_id = _team_id AND board_id IS NULL),
  rev AS (
    SELECT r.board_id, date_trunc('month', r.competence)::date m, sum(r.gross_amount) gross,
      sum(r.gross_amount * COALESCE(r.tax_rate, bc.tax_rate, (SELECT tax_rate FROM team_cfg), 0.21)) tax
    FROM public.finance_revenues r
    LEFT JOIN public.finance_settings bc ON bc.team_id = r.team_id AND bc.board_id = r.board_id
    WHERE r.team_id = _team_id AND r.board_id IN (SELECT id FROM bs) AND r.competence BETWEEN date_trunc('month', _from)::date AND _to
    GROUP BY 1, 2
  ),
  exp AS (
    SELECT e.board_id, date_trunc('month', e.competence)::date m, sum(e.amount) amt
    FROM public.finance_expenses e
    WHERE e.team_id = _team_id AND e.board_id IN (SELECT id FROM bs) AND e.competence BETWEEN date_trunc('month', _from)::date AND _to
    GROUP BY 1, 2
  ),
  alloc AS (
    SELECT a.board_id, a.competence m, sum(a.amount) amt FROM public._finance_allocations(_team_id, _from, _to) a
    WHERE a.board_id IN (SELECT id FROM bs) GROUP BY 1, 2
  ),
  hrs AS (
    SELECT d.board_id, date_trunc('month', t.started_at)::date m, t.user_id, sum(COALESCE(t.duration_seconds, 0)) / 3600.0 h
    FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id
    WHERE d.board_id IN (SELECT id FROM bs) AND t.started_at >= date_trunc('month', _from) AND t.started_at < (date_trunc('month', _to) + interval '1 month')
    GROUP BY 1, 2, 3
  ),
  cost AS (
    SELECT h.board_id, h.m, sum(h.h) h_total,
      sum(CASE WHEN c.id IS NOT NULL AND c.productive_hours > 0 THEN h.h * c.monthly_cost / c.productive_hours ELSE 0 END) cost,
      sum(CASE WHEN c.id IS NULL THEN h.h ELSE 0 END) h_missing
    FROM hrs h LEFT JOIN public.finance_employee_costs c
      ON c.team_id = _team_id AND c.user_id = h.user_id AND c.competence = h.m
    GROUP BY 1, 2
  ),
  plan AS (
    SELECT d.board_id, date_trunc('month', d.created_at)::date m, sum(COALESCE(s.estimated_hours, s.hours_max, 0)) h
    FROM public.demands d JOIN public.services s ON s.id = d.service_id
    WHERE d.board_id IN (SELECT id FROM bs) AND d.archived = false
      AND d.created_at >= date_trunc('month', _from) AND d.created_at < (date_trunc('month', _to) + interval '1 month')
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
REVOKE ALL ON FUNCTION public.get_finance_overview(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_finance_overview(uuid, date, date) TO authenticated;

-- Allocation detail: one row per shared expense x visible board. Description/total only reach viewers of that board;
-- the unallocated remainder (board_id NULL rows) only reaches team-level viewers.
CREATE OR REPLACE FUNCTION public.get_finance_allocation(_team_id uuid, _from date, _to date)
RETURNS TABLE(expense_id uuid, description text, expense_type text, allocation_method text, competence date, total numeric, board_id uuid, board_name text, amount numeric, share numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH me AS (SELECT auth.uid() uid),
  team_view AS (SELECT public.has_finance_permission(me.uid, 'finance.view_team', _team_id) ok FROM me),
  a AS (SELECT * FROM public._finance_allocations(_team_id, _from, _to)),
  visible AS (
    SELECT a.*, b.name FROM a JOIN public.boards b ON b.id = a.board_id, me
    WHERE public.can_view_finance_board(me.uid, _team_id, a.board_id)
  ),
  ex AS (
    SELECT e.* FROM public.finance_expenses e
    WHERE e.team_id = _team_id AND e.board_id IS NULL AND e.allocation_method IS NOT NULL
      AND e.competence BETWEEN date_trunc('month', _from)::date AND _to
  )
  SELECT ex.id, ex.description, ex.expense_type, ex.allocation_method, date_trunc('month', ex.competence)::date, ex.amount, v.board_id, v.name, v.amount, v.share
  FROM visible v JOIN ex ON ex.id = v.expense_id
  UNION ALL
  SELECT ex.id, ex.description, ex.expense_type, ex.allocation_method, date_trunc('month', ex.competence)::date, ex.amount, NULL, NULL,
    ex.amount - COALESCE((SELECT sum(a.amount) FROM a WHERE a.expense_id = ex.id), 0), NULL
  FROM ex, team_view WHERE team_view.ok
    AND ex.amount - COALESCE((SELECT sum(a.amount) FROM a WHERE a.expense_id = ex.id), 0) > 0.004
$$;
REVOKE ALL ON FUNCTION public.get_finance_allocation(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_finance_allocation(uuid, date, date) TO authenticated;

-- People / productivity. Per-person rows only with view_employee_costs; otherwise per board aggregates (user_id NULL) for visible boards.
CREATE OR REPLACE FUNCTION public.get_finance_people(_team_id uuid, _from date, _to date)
RETURNS TABLE(user_id uuid, full_name text, competence date, monthly_cost numeric, productive_hours numeric, board_id uuid, board_name text, hours numeric, cost numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH me AS (SELECT auth.uid() uid),
  detail AS (SELECT public.has_finance_permission(me.uid, 'finance.view_employee_costs', _team_id) ok FROM me),
  months AS (SELECT generate_series(date_trunc('month', _from)::date, date_trunc('month', _to)::date, interval '1 month')::date AS m),
  bs AS (SELECT b.id, b.name FROM public.boards b, me WHERE b.team_id = _team_id AND public.can_view_finance_board(me.uid, _team_id, b.id)),
  hrs AS (
    SELECT t.user_id, d.board_id, date_trunc('month', t.started_at)::date m, sum(COALESCE(t.duration_seconds,0))/3600.0 h
    FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id
    WHERE d.board_id IN (SELECT id FROM bs) AND t.started_at >= date_trunc('month', _from) AND t.started_at < date_trunc('month', _to) + interval '1 month'
    GROUP BY 1,2,3
  ),
  priced AS (
    SELECT h.*, c.monthly_cost, c.productive_hours,
      CASE WHEN c.productive_hours > 0 THEN h.h * c.monthly_cost / c.productive_hours END cost
    FROM hrs h LEFT JOIN public.finance_employee_costs c ON c.team_id = _team_id AND c.user_id = h.user_id AND c.competence = h.m
  )
  SELECT p.user_id, pr.full_name, p.m, p.monthly_cost, p.productive_hours, p.board_id, bs.name, p.h, p.cost
  FROM priced p JOIN bs ON bs.id = p.board_id LEFT JOIN public.profiles pr ON pr.id = p.user_id, detail WHERE detail.ok
  UNION ALL
  -- people with a registered cost but no hours in the month (detail only)
  SELECT c.user_id, pr.full_name, c.competence, c.monthly_cost, c.productive_hours, NULL, NULL, 0, NULL
  FROM public.finance_employee_costs c JOIN months ON months.m = c.competence LEFT JOIN public.profiles pr ON pr.id = c.user_id, detail
  WHERE detail.ok AND c.team_id = _team_id AND NOT EXISTS (SELECT 1 FROM hrs WHERE hrs.user_id = c.user_id AND hrs.m = c.competence)
  UNION ALL
  SELECT NULL, NULL, p.m, NULL, NULL, p.board_id, bs.name, sum(p.h), sum(COALESCE(p.cost,0))
  FROM priced p JOIN bs ON bs.id = p.board_id, detail WHERE NOT detail.ok GROUP BY p.m, p.board_id, bs.name
$$;
REVOKE ALL ON FUNCTION public.get_finance_people(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_finance_people(uuid, date, date) TO authenticated;