CREATE OR REPLACE FUNCTION public.revoke_access_on_team_member_removed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.board_members bm
  USING public.boards b
  WHERE bm.board_id = b.id
    AND b.team_id = OLD.team_id
    AND bm.user_id = OLD.user_id;

  DELETE FROM public.project_shares ps
  USING public.projects p
  WHERE ps.project_id = p.id
    AND p.team_id = OLD.team_id
    AND ps.user_id = OLD.user_id;

  DELETE FROM public.demand_assignees da
  USING public.demands d
  WHERE da.demand_id = d.id
    AND d.team_id = OLD.team_id
    AND da.user_id = OLD.user_id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_team_member_removed ON public.team_members;
CREATE TRIGGER on_team_member_removed
AFTER DELETE ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.revoke_access_on_team_member_removed();