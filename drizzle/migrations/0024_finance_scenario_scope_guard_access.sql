CREATE OR REPLACE FUNCTION public.guard_finance_scenario() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.boards b WHERE b.id = NEW.board_id AND b.team_id = NEW.team_id) THEN RAISE EXCEPTION 'BOARD_TEAM_MISMATCH'; END IF;
 IF TG_OP = 'UPDATE' THEN
  IF NEW.team_id <> OLD.team_id OR NEW.board_id <> OLD.board_id OR NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN RAISE EXCEPTION 'SCENARIO_SCOPE_IMMUTABLE'; END IF;
 END IF;
 NEW.updated_at := now();
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_finance_scenario() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.guard_finance_scenario() IS 'Validates structural scope independently of operational board RLS; finance write authorization remains enforced by scenario RLS.';