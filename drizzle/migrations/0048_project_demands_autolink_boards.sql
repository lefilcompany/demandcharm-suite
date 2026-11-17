CREATE OR REPLACE FUNCTION public.finance_autolink_project_board(_project uuid, _board uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _team uuid; _by uuid; _from date;
BEGIN
  IF _board IS NULL THEN RETURN; END IF;
  SELECT team_id, created_by, date_trunc('month', created_at)::date INTO _team, _by, _from FROM public.projects WHERE id = _project;
  IF _team IS NULL OR NOT EXISTS (SELECT 1 FROM public.boards WHERE id = _board AND team_id = _team) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.project_boards WHERE project_id = _project AND board_id = _board AND valid_to IS NULL) THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.project_boards WHERE project_id = _project AND board_id = _board) THEN RETURN; END IF; -- respect a manual unlink
  SELECT LEAST(_from, COALESCE((SELECT min(competence) FROM public.finance_revenues WHERE board_id = _board), _from),
                      COALESCE((SELECT min(competence) FROM public.finance_expenses WHERE board_id = _board), _from))::date INTO _from;
  INSERT INTO public.project_boards(project_id, board_id, team_id, valid_from, created_by)
  VALUES (_project, _board, _team, date_trunc('month', _from)::date, COALESCE(auth.uid(), _by));
END $function$;
REVOKE EXECUTE ON FUNCTION public.finance_autolink_project_board(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_project_demand_autolink()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.finance_autolink_project_board(NEW.project_id, (SELECT board_id FROM public.demands WHERE id = NEW.demand_id));
  RETURN NULL;
END $function$;

DROP TRIGGER IF EXISTS trg_project_demand_autolink ON public.project_demands;
CREATE TRIGGER trg_project_demand_autolink AFTER INSERT ON public.project_demands
FOR EACH ROW EXECUTE FUNCTION public.trg_project_demand_autolink();

DO $$ DECLARE _x record; BEGIN
  FOR _x IN SELECT DISTINCT pd.project_id, d.board_id FROM public.project_demands pd JOIN public.demands d ON d.id = pd.demand_id LOOP
    PERFORM public.finance_autolink_project_board(_x.project_id, _x.board_id);
  END LOOP;
END $$;