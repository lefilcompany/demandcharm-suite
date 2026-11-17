CREATE OR REPLACE FUNCTION public.finance_auto_attribute_demand(_demand_id uuid, _competence date)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _board uuid; _team uuid; _cnt int; _proj uuid; _comp date := date_trunc('month', _competence)::date;
BEGIN
  SELECT d.board_id, b.team_id INTO _board, _team FROM public.demands d JOIN public.boards b ON b.id = d.board_id WHERE d.id = _demand_id;
  IF _team IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.finance_demand_attributions WHERE demand_id = _demand_id AND competence = _comp AND status = 'manual') THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.finance_periods fp WHERE fp.team_id = _team AND fp.competence = _comp AND fp.closed_at IS NOT NULL) THEN RETURN; END IF;
  -- 1) demand explicitly added to a finance-enabled project
  SELECT count(DISTINCT pd.project_id), min(pd.project_id::text)::uuid INTO _cnt, _proj
  FROM public.project_demands pd JOIN public.projects p ON p.id = pd.project_id AND p.finance_enabled AND p.team_id = _team
  WHERE pd.demand_id = _demand_id;
  -- 2) fallback: board linked to a project
  IF _cnt = 0 THEN
    SELECT count(DISTINCT pb.project_id), min(pb.project_id::text)::uuid INTO _cnt, _proj
    FROM public.project_boards pb JOIN public.projects p ON p.id = pb.project_id AND p.finance_enabled
    WHERE pb.board_id = _board AND pb.valid_from <= (_comp + interval '1 month' - interval '1 day')::date
      AND (pb.valid_to IS NULL OR pb.valid_to >= _comp);
  END IF;
  INSERT INTO public.finance_demand_attributions(team_id, demand_id, competence, project_id, status, reason)
  VALUES (_team, _demand_id, _comp, CASE WHEN _cnt = 1 THEN _proj END, CASE WHEN _cnt = 1 THEN 'auto' ELSE 'pending' END,
          CASE WHEN _cnt = 0 THEN 'NO_PROJECT' WHEN _cnt > 1 THEN 'MULTIPLE_PROJECTS' END)
  ON CONFLICT (demand_id, competence) DO UPDATE SET project_id = EXCLUDED.project_id, status = EXCLUDED.status, reason = EXCLUDED.reason, team_id = EXCLUDED.team_id, updated_at = now()
  WHERE public.finance_demand_attributions.status <> 'manual';
END $function$;

CREATE OR REPLACE FUNCTION public.finance_reattribute_demand_all_months(_demand_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _m date;
BEGIN
  FOR _m IN
    SELECT DISTINCT public._sp_month(te.started_at) FROM public.demand_time_entries te WHERE te.demand_id = _demand_id AND te.started_at IS NOT NULL
    UNION SELECT date_trunc('month', now())::date
  LOOP
    PERFORM public.finance_auto_attribute_demand(_demand_id, _m);
  END LOOP;
END $function$;
REVOKE EXECUTE ON FUNCTION public.finance_reattribute_demand_all_months(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_project_demand_finance()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _r record; d public.finance_team_defaults; _team uuid;
BEGIN
  _r := COALESCE(NEW, OLD);
  PERFORM public.finance_reattribute_demand_all_months(_r.demand_id);
  IF TG_OP = 'INSERT' AND NOT EXISTS (SELECT 1 FROM public.finance_project_settings WHERE project_id = NEW.project_id) THEN
    SELECT team_id INTO _team FROM public.projects WHERE id = NEW.project_id;
    SELECT * INTO d FROM public.finance_team_defaults WHERE team_id = _team AND valid_from <= current_date ORDER BY valid_from DESC LIMIT 1;
    IF d.id IS NOT NULL THEN
      INSERT INTO public.finance_project_settings(project_id, team_id, valid_from, tax_rate, variable_rate, margin_target, created_by)
      VALUES (NEW.project_id, _team, date_trunc('month', current_date)::date, d.tax_rate, d.variable_rate, d.margin_target, COALESCE(auth.uid(), d.created_by))
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NULL;
END $function$;

DROP TRIGGER IF EXISTS trg_project_demand_finance ON public.project_demands;
CREATE TRIGGER trg_project_demand_finance AFTER INSERT OR DELETE ON public.project_demands
FOR EACH ROW EXECUTE FUNCTION public.trg_project_demand_finance();

-- backfill existing project demands
DO $$ DECLARE _x record; BEGIN
  FOR _x IN SELECT DISTINCT demand_id FROM public.project_demands LOOP
    PERFORM public.finance_reattribute_demand_all_months(_x.demand_id);
  END LOOP;
END $$;