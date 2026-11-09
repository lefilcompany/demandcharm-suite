CREATE OR REPLACE FUNCTION public._finance_project_month_live(_project_id uuid, _competence date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _comp date := date_trunc('month', _competence)::date;
  _end date := (date_trunc('month', _competence) + interval '1 month - 1 day')::date;
  _p record; _ct numeric; _cm numeric; _pt numeric; _pv numeric; _pm numeric;
  _boards uuid[]; _gross numeric; _tax numeric; _direct numeric; _fixa numeric; _oper numeric; _adm numeric;
  _hours numeric; _cost numeric; _miss_h numeric; _miss_p int; _status text; _tax_rate numeric; _target numeric; _var numeric;
BEGIN
  SELECT id, team_id, name, finance_enabled, unit_external_id, integration_key INTO _p FROM projects WHERE id = _project_id;
  IF _p.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  SELECT tax_rate, margin_target INTO _ct, _cm FROM finance_settings WHERE team_id = _p.team_id AND board_id IS NULL LIMIT 1;
  SELECT tax_rate, variable_rate, margin_target INTO _pt, _pv, _pm FROM finance_project_settings
    WHERE project_id = _project_id AND valid_from <= _comp ORDER BY valid_from DESC LIMIT 1;
  _tax_rate := coalesce(_pt, _ct, 0.21);
  _target := coalesce(_pm, _cm, 0.40);
  _var := coalesce(_pv, 0);

  SELECT coalesce(array_agg(DISTINCT board_id), '{}') INTO _boards FROM project_boards
    WHERE project_id = _project_id AND valid_from <= _end AND (valid_to IS NULL OR valid_to >= _comp);

  SELECT coalesce(sum(gross_amount), 0), coalesce(sum(gross_amount * coalesce(tax_rate, _tax_rate)), 0) INTO _gross, _tax
    FROM finance_revenues WHERE team_id = _p.team_id AND board_id = ANY(_boards) AND date_trunc('month', competence)::date = _comp;
  SELECT coalesce(sum(amount), 0) INTO _direct FROM finance_expenses
    WHERE team_id = _p.team_id AND board_id = ANY(_boards) AND date_trunc('month', competence)::date = _comp;
  SELECT coalesce(sum(al.amount) FILTER (WHERE e.expense_type = 'fixa'), 0),
         coalesce(sum(al.amount) FILTER (WHERE e.expense_type = 'operacional'), 0),
         coalesce(sum(al.amount) FILTER (WHERE e.expense_type NOT IN ('fixa','operacional')), 0)
    INTO _fixa, _oper, _adm
    FROM _finance_allocations(_p.team_id, _comp, _comp) al JOIN finance_expenses e ON e.id = al.expense_id
    WHERE al.board_id = ANY(_boards);

  WITH s AS (
    SELECT sl.user_id, sum(sl.hours) h FROM _finance_time_slices(_p.team_id, _comp) sl
    JOIN finance_demand_attributions a ON a.demand_id = sl.demand_id AND a.competence = _comp AND a.project_id = _project_id
    GROUP BY sl.user_id
  ), c AS (
    SELECT s.user_id, s.h, (SELECT CASE WHEN ec.productive_hours > 0 THEN ec.monthly_cost / ec.productive_hours END
      FROM finance_employee_costs ec WHERE ec.team_id = _p.team_id AND ec.user_id = s.user_id AND ec.competence = _comp LIMIT 1) hr
    FROM s
  )
  SELECT coalesce(sum(h), 0), coalesce(sum(h * hr), 0), coalesce(sum(h) FILTER (WHERE hr IS NULL), 0), count(*) FILTER (WHERE hr IS NULL)
    INTO _hours, _cost, _miss_h, _miss_p FROM c;

  SELECT status INTO _status FROM finance_periods WHERE team_id = _p.team_id AND competence = _comp;

  RETURN jsonb_build_object(
    'project_id', _p.id, 'project_name', _p.name, 'team_id', _p.team_id,
    'unit_external_id', _p.unit_external_id, 'integration_key', _p.integration_key, 'finance_enabled', _p.finance_enabled,
    'competence', _comp, 'period_status', coalesce(_status, 'open'), 'board_ids', to_jsonb(_boards),
    'tax_rate', _tax_rate, 'variable_rate', _var, 'margin_target', _target,
    'gross', round(_gross, 2), 'tax', round(_tax, 2), 'variable_costs', round(_gross * _var, 2),
    'direct_expenses', round(_direct, 2), 'alloc_fixed', round(_fixa, 2), 'alloc_operational', round(_oper, 2), 'alloc_admin', round(_adm, 2),
    'team_cost', round(_cost, 2), 'hours', round(_hours, 2), 'hours_without_cost', round(_miss_h, 2), 'people_without_cost', _miss_p);
END $function$;
REVOKE ALL ON FUNCTION public._finance_project_month_live(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE TABLE public.finance_project_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.finance_periods(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  team_id uuid NOT NULL,
  competence date NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, competence)
);
GRANT SELECT ON public.finance_project_snapshots TO authenticated;
GRANT ALL ON public.finance_project_snapshots TO service_role;
ALTER TABLE public.finance_project_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY fps_select ON public.finance_project_snapshots FOR SELECT TO authenticated
  USING (public.can_read_finance_structure((select auth.uid()), team_id)
      OR public.has_finance_permission((select auth.uid()), 'finance.view_project', team_id, NULL));
CREATE INDEX finance_project_snapshots_team_idx ON public.finance_project_snapshots(team_id, competence);

CREATE OR REPLACE FUNCTION public._finance_project_month(_project_id uuid, _competence date)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _comp date := date_trunc('month', _competence)::date; _d jsonb; _st text;
BEGIN
  SELECT s.data, p.status INTO _d, _st FROM finance_project_snapshots s JOIN finance_periods p ON p.id = s.period_id
    WHERE s.project_id = _project_id AND s.competence = _comp;
  IF _d IS NOT NULL AND _st <> 'open' THEN
    RETURN _d || jsonb_build_object('period_status', _st, 'from_snapshot', true);
  END IF;
  RETURN public._finance_project_month_live(_project_id, _comp) || jsonb_build_object('from_snapshot', false);
END $$;
REVOKE ALL ON FUNCTION public._finance_project_month(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.finance_snapshot_projects_on_close()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _r record;
BEGIN
  IF NEW.status = 'open' OR (TG_OP = 'UPDATE' AND OLD.status <> 'open') THEN RETURN NEW; END IF;
  FOR _r IN SELECT id FROM projects WHERE team_id = NEW.team_id AND finance_enabled LOOP
    INSERT INTO finance_project_snapshots(period_id, project_id, team_id, competence, data)
    VALUES (NEW.id, _r.id, NEW.team_id, NEW.competence, public._finance_project_month_live(_r.id, NEW.competence))
    ON CONFLICT (project_id, competence) DO NOTHING;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.finance_snapshot_projects_on_close() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_finance_snapshot_projects AFTER INSERT OR UPDATE OF status ON public.finance_periods
  FOR EACH ROW EXECUTE FUNCTION public.finance_snapshot_projects_on_close();

CREATE OR REPLACE FUNCTION public.get_team_projects_finance(_team_id uuid, _from date, _to date)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := (select auth.uid()); _out jsonb := '[]'::jsonb; _p record; _m date; _months jsonb;
BEGIN
  IF NOT (public.can_read_finance_structure(_uid, _team_id) OR public.has_finance_permission(_uid, 'finance.view_project', _team_id, NULL)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _to < _from OR _to > _from + interval '24 months' THEN RAISE EXCEPTION 'INVALID_RANGE'; END IF;
  FOR _p IN SELECT id, name FROM projects WHERE team_id = _team_id AND finance_enabled ORDER BY name LOOP
    _months := '[]'::jsonb;
    FOR _m IN SELECT generate_series(date_trunc('month', _from), date_trunc('month', _to), interval '1 month')::date LOOP
      _months := _months || jsonb_build_array(public._finance_project_month(_p.id, _m));
    END LOOP;
    _out := _out || jsonb_build_array(jsonb_build_object('project_id', _p.id, 'name', _p.name, 'months', _months));
  END LOOP;
  RETURN _out;
END $$;
REVOKE ALL ON FUNCTION public.get_team_projects_finance(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_projects_finance(uuid, date, date) TO authenticated;

INSERT INTO public.finance_project_snapshots(period_id, project_id, team_id, competence, data)
SELECT fp.id, p.id, fp.team_id, fp.competence, public._finance_project_month_live(p.id, fp.competence)
FROM public.finance_periods fp JOIN public.projects p ON p.team_id = fp.team_id AND p.finance_enabled
WHERE fp.status <> 'open'
ON CONFLICT (project_id, competence) DO NOTHING;