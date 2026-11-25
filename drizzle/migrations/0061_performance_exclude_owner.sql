CREATE OR REPLACE FUNCTION public.guard_performance_member_internal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_team uuid; v_kind text; v_mteam uuid; v_role text;
BEGIN
  SELECT team_id INTO v_team FROM public.team_performances WHERE id = NEW.performance_id;
  SELECT team_id, member_kind, role::text INTO v_mteam, v_kind, v_role FROM public.team_members WHERE id = NEW.team_member_id;
  IF v_mteam IS NULL OR v_mteam <> v_team THEN
    RAISE EXCEPTION 'PERFORMANCE_MEMBER_OTHER_TEAM' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(v_kind, 'internal') <> 'internal' THEN
    RAISE EXCEPTION 'PERFORMANCE_MEMBER_NOT_INTERNAL' USING ERRCODE = 'P0001';
  END IF;
  IF v_role = 'admin' THEN
    RAISE EXCEPTION 'PERFORMANCE_MEMBER_IS_OWNER' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DELETE FROM public.team_performance_members pm USING public.team_members tm
WHERE tm.id = pm.team_member_id AND tm.role = 'admin';