CREATE TABLE public.finance_scenarios (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
 board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
 name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 160),
 client_label text NOT NULL DEFAULT '' CHECK (length(client_label) <= 160),
 competence date NOT NULL,
 gross numeric NOT NULL DEFAULT 0 CHECK (gross >= 0 AND gross < 1e12),
 tax_rate numeric NOT NULL DEFAULT 0.21 CHECK (tax_rate >= 0 AND tax_rate <= 1),
 variable_rate numeric NOT NULL DEFAULT 0 CHECK (variable_rate >= 0 AND variable_rate <= 1),
 margin_target numeric NOT NULL DEFAULT 0.40 CHECK (margin_target >= 0 AND margin_target <= 1),
 team_cost numeric NOT NULL DEFAULT 0 CHECK (team_cost >= 0 AND team_cost < 1e12),
 planned_hours numeric NOT NULL DEFAULT 0 CHECK (planned_hours >= 0 AND planned_hours < 1e9),
 direct_expenses numeric NOT NULL DEFAULT 0 CHECK (direct_expenses >= 0 AND direct_expenses < 1e12),
 shared_costs numeric NOT NULL DEFAULT 0 CHECK (shared_costs >= 0 AND shared_costs < 1e12),
 created_by uuid NOT NULL DEFAULT auth.uid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_scenarios TO authenticated;
GRANT ALL ON public.finance_scenarios TO service_role;
ALTER TABLE public.finance_scenarios ENABLE ROW LEVEL SECURITY;
CREATE INDEX finance_scenarios_scope ON public.finance_scenarios(team_id, board_id, updated_at DESC);
CREATE POLICY scenario_read ON public.finance_scenarios FOR SELECT TO authenticated USING (public.can_view_finance_board((select auth.uid()), team_id, board_id));
CREATE POLICY scenario_insert ON public.finance_scenarios FOR INSERT TO authenticated WITH CHECK (created_by = (select auth.uid()) AND public.can_view_finance_board((select auth.uid()), team_id, board_id) AND public.has_finance_permission((select auth.uid()), 'finance.manage_revenue', team_id, board_id));
CREATE POLICY scenario_update ON public.finance_scenarios FOR UPDATE TO authenticated USING (public.can_view_finance_board((select auth.uid()), team_id, board_id) AND public.has_finance_permission((select auth.uid()), 'finance.manage_revenue', team_id, board_id)) WITH CHECK (public.can_view_finance_board((select auth.uid()), team_id, board_id) AND public.has_finance_permission((select auth.uid()), 'finance.manage_revenue', team_id, board_id));
CREATE POLICY scenario_delete ON public.finance_scenarios FOR DELETE TO authenticated USING (public.can_view_finance_board((select auth.uid()), team_id, board_id) AND public.has_finance_permission((select auth.uid()), 'finance.manage_revenue', team_id, board_id));
CREATE FUNCTION public.guard_finance_scenario() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.boards b WHERE b.id = NEW.board_id AND b.team_id = NEW.team_id) THEN RAISE EXCEPTION 'BOARD_TEAM_MISMATCH'; END IF;
 IF TG_OP = 'UPDATE' THEN
  IF NEW.team_id <> OLD.team_id OR NEW.board_id <> OLD.board_id OR NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN RAISE EXCEPTION 'SCENARIO_SCOPE_IMMUTABLE'; END IF;
 END IF;
 NEW.updated_at := now();
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_finance_scenario() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER scenario_guard BEFORE INSERT OR UPDATE ON public.finance_scenarios FOR EACH ROW EXECUTE FUNCTION public.guard_finance_scenario();
CREATE TRIGGER scenario_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_scenarios FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();
CREATE FUNCTION public.export_finance_scenarios(_team_id uuid, _ids uuid[]) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _result jsonb; _count integer;
BEGIN
 IF _me IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
 IF COALESCE(cardinality(_ids),0) NOT BETWEEN 1 AND 3 THEN RAISE EXCEPTION 'SELECT_ONE_TO_THREE'; END IF;
 SELECT count(*) INTO _count FROM public.finance_scenarios s WHERE s.id = ANY(_ids) AND s.team_id = _team_id AND public.can_view_finance_board(_me, s.team_id, s.board_id) AND public.has_finance_permission(_me, 'finance.export', s.team_id, s.board_id);
 IF _count <> cardinality(_ids) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
 SELECT jsonb_agg(to_jsonb(s) || jsonb_build_object('board_name', b.name) ORDER BY s.name) INTO _result FROM public.finance_scenarios s JOIN public.boards b ON b.id=s.board_id WHERE s.team_id=_team_id AND s.id=ANY(_ids);
 INSERT INTO public.finance_audit_log(team_id,actor_id,action,entity,after_data) VALUES (_team_id,_me,'export','finance_scenarios',jsonb_build_object('ids',_ids));
 RETURN _result;
END $$;
REVOKE EXECUTE ON FUNCTION public.export_finance_scenarios(uuid,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.export_finance_scenarios(uuid,uuid[]) TO authenticated;
COMMENT ON TABLE public.finance_scenarios IS 'Pricing estimates only; stores aggregate cost assumptions, never individual salary or employee planning rows.';