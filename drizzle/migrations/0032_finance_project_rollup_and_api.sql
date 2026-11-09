CREATE TABLE public.finance_project_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  valid_from date NOT NULL,
  tax_rate numeric NOT NULL CHECK (tax_rate >= 0 AND tax_rate < 1),
  variable_rate numeric NOT NULL DEFAULT 0 CHECK (variable_rate >= 0 AND variable_rate < 1),
  margin_target numeric NOT NULL CHECK (margin_target >= 0 AND margin_target < 1),
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, valid_from),
  CHECK (valid_from = date_trunc('month', valid_from)::date)
);
GRANT SELECT, INSERT, DELETE ON public.finance_project_settings TO authenticated;
GRANT ALL ON public.finance_project_settings TO service_role;
ALTER TABLE public.finance_project_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.trg_finance_project_settings_team() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT team_id INTO NEW.team_id FROM projects WHERE id = NEW.project_id;
  IF NEW.team_id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER a_finance_project_settings_team BEFORE INSERT ON public.finance_project_settings
FOR EACH ROW EXECUTE FUNCTION public.trg_finance_project_settings_team();

CREATE POLICY fps_select ON public.finance_project_settings FOR SELECT TO authenticated
USING (public.can_read_finance_structure((select auth.uid()), team_id)
  OR public.has_finance_permission((select auth.uid()), 'finance.view_project', team_id, NULL));
CREATE POLICY fps_insert ON public.finance_project_settings FOR INSERT TO authenticated
WITH CHECK (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL)
  OR public.can_manage_finance_access((select auth.uid()), team_id));
CREATE POLICY fps_delete ON public.finance_project_settings FOR DELETE TO authenticated
USING (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL)
  OR public.can_manage_finance_access((select auth.uid()), team_id));

CREATE TRIGGER finance_project_settings_audit AFTER INSERT OR DELETE ON public.finance_project_settings
FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();

CREATE OR REPLACE FUNCTION public._finance_project_month(_project_id uuid, _competence date)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
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
END $$;
REVOKE ALL ON FUNCTION public._finance_project_month(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._finance_project_month(uuid, date) TO service_role;

CREATE OR REPLACE FUNCTION public.get_project_finance_overview(_project_id uuid, _from date, _to date)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := (select auth.uid()); _team uuid; _out jsonb := '[]'::jsonb; _m date;
BEGIN
  SELECT team_id INTO _team FROM projects WHERE id = _project_id;
  IF _team IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT (public.can_read_finance_structure(_uid, _team) OR public.has_finance_permission(_uid, 'finance.view_project', _team, NULL)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  IF _to < _from OR _to > _from + interval '24 months' THEN RAISE EXCEPTION 'INVALID_RANGE'; END IF;
  FOR _m IN SELECT generate_series(date_trunc('month', _from), date_trunc('month', _to), interval '1 month')::date LOOP
    _out := _out || jsonb_build_array(public._finance_project_month(_project_id, _m));
  END LOOP;
  RETURN _out;
END $$;
REVOKE ALL ON FUNCTION public.get_project_finance_overview(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_finance_overview(uuid, date, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.finance_people_gaps(_team_id uuid, _competence date)
RETURNS TABLE(user_id uuid, name text, hours numeric, missing_kind boolean, missing_cost boolean)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := (select auth.uid()); _comp date := date_trunc('month', _competence)::date;
BEGIN
  IF NOT (public.has_finance_permission(_uid, 'finance.view_employee_costs', _team_id, NULL)
       OR public.has_finance_permission(_uid, 'finance.manage_settings', _team_id, NULL)
       OR public.can_manage_finance_access(_uid, _team_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY
  WITH s AS (SELECT sl.user_id u, sum(sl.hours) h FROM _finance_time_slices(_team_id, _comp) sl GROUP BY sl.user_id),
  f AS (
    SELECT s.u, s.h,
      NOT EXISTS (SELECT 1 FROM finance_member_profiles mp WHERE mp.team_id = _team_id AND mp.user_id = s.u
        AND mp.valid_from <= (_comp + interval '1 month - 1 day')::date AND (mp.valid_to IS NULL OR mp.valid_to >= _comp)) mk,
      NOT EXISTS (SELECT 1 FROM finance_employee_costs ec WHERE ec.team_id = _team_id AND ec.user_id = s.u
        AND ec.competence = _comp AND ec.productive_hours > 0) mc
    FROM s WHERE s.h > 0
  )
  SELECT f.u, coalesce(p.full_name, 'Sem nome'), round(f.h, 2), f.mk, f.mc
  FROM f LEFT JOIN profiles p ON p.id = f.u WHERE f.mk OR f.mc ORDER BY f.h DESC;
END $$;
REVOKE ALL ON FUNCTION public.finance_people_gaps(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finance_people_gaps(uuid, date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_finance_api_key(_team_id uuid, _name text)
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE _uid uuid := (select auth.uid()); _key text; _id uuid;
BEGIN
  IF NOT public.can_manage_finance_access(_uid, _team_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  _key := 'sk_fin_' || encode(extensions.gen_random_bytes(24), 'hex');
  INSERT INTO api_keys (team_id, name, key_hash, key_prefix, permissions, is_active, created_by)
  VALUES (_team_id, coalesce(nullif(trim(_name), ''), 'Painel financeiro'), encode(extensions.digest(_key, 'sha256'), 'hex'),
          left(_key, 12), '{"finance.read": true}'::jsonb, true, _uid)
  RETURNING id INTO _id;
  INSERT INTO finance_audit_log (team_id, actor_id, action, entity, entity_id, after_data)
  VALUES (_team_id, _uid, 'create_api_key', 'api_keys', _id, jsonb_build_object('prefix', left(_key, 12)));
  RETURN _key;
END $$;
REVOKE ALL ON FUNCTION public.create_finance_api_key(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_finance_api_key(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_api_v1_page(_team_id uuid, _competence date, _cursor uuid, _limit int)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE _items jsonb := '[]'::jsonb; _last uuid; _r record; _n int := 0; _lim int := least(greatest(coalesce(_limit, 50), 1), 200);
BEGIN
  FOR _r IN SELECT id FROM projects WHERE team_id = _team_id AND finance_enabled AND (_cursor IS NULL OR id > _cursor) ORDER BY id LIMIT _lim + 1 LOOP
    _n := _n + 1;
    EXIT WHEN _n > _lim;
    _items := _items || jsonb_build_array(public._finance_project_month(_r.id, _competence));
    _last := _r.id;
  END LOOP;
  RETURN jsonb_build_object('version', 'v1', 'competence', date_trunc('month', _competence)::date,
    'generated_at', now(), 'items', _items, 'next_cursor', CASE WHEN _n > _lim THEN _last END);
END $$;
REVOKE ALL ON FUNCTION public.finance_api_v1_page(uuid, date, uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_api_v1_page(uuid, date, uuid, int) TO service_role;