CREATE OR REPLACE FUNCTION public.assign_access_profile(_team_id uuid, _user_id uuid, _profile_id uuid, _all_projects boolean, _project_ids uuid[])
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _perms text[]; _kind text; _role text; _aid uuid;
BEGIN
  IF NOT public.can_manage_finance_access(_me, _team_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  -- Owners may change their own profile; anyone else is blocked by can_manage_finance_access.
  SELECT role::text, member_kind INTO _role, _kind FROM public.team_members WHERE team_id=_team_id AND user_id=_user_id;
  IF _role IS NULL THEN RAISE EXCEPTION 'USER_NOT_IN_TEAM'; END IF;
  SELECT permissions INTO _perms FROM public.access_profiles WHERE id=_profile_id AND (is_system OR team_id=_team_id);
  IF _perms IS NULL THEN RAISE EXCEPTION 'PROFILE_NOT_FOUND'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(_perms) x WHERE x LIKE 'finance.%') AND (_role = 'requester' OR _kind = 'client_external') THEN
    RAISE EXCEPTION 'FINANCE_NOT_ALLOWED_FOR_MEMBER';
  END IF;
  IF NOT _all_projects AND EXISTS (SELECT 1 FROM unnest(coalesce(_project_ids,'{}')) p WHERE NOT EXISTS (SELECT 1 FROM public.projects pr WHERE pr.id=p AND pr.team_id=_team_id)) THEN
    RAISE EXCEPTION 'PROJECT_NOT_IN_TEAM';
  END IF;
  INSERT INTO public.member_access_profiles(team_id,user_id,profile_id,all_projects,assigned_by)
  VALUES (_team_id,_user_id,_profile_id,_all_projects,_me)
  ON CONFLICT (team_id,user_id) DO UPDATE SET profile_id=EXCLUDED.profile_id, all_projects=EXCLUDED.all_projects, assigned_by=EXCLUDED.assigned_by, assigned_at=now()
  RETURNING id INTO _aid;
  DELETE FROM public.member_access_project_scope WHERE assignment_id=_aid;
  IF NOT _all_projects THEN
    INSERT INTO public.member_access_project_scope(assignment_id,project_id) SELECT _aid, unnest(coalesce(_project_ids,'{}')) ON CONFLICT DO NOTHING;
  END IF;
  UPDATE public.finance_permissions SET revoked_at=now(), revoked_by=_me WHERE team_id=_team_id AND user_id=_user_id AND revoked_at IS NULL;
  INSERT INTO public.finance_audit_log(team_id,actor_id,action,entity,entity_id,after_data)
  VALUES (_team_id,_me,'assign','member_access_profiles',_aid,jsonb_build_object('user_id',_user_id,'profile_id',_profile_id,'all_projects',_all_projects,'project_ids',_project_ids));
  RETURN _aid;
END $function$;

CREATE OR REPLACE FUNCTION public.default_owner_finance_profile()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    INSERT INTO public.member_access_profiles(team_id,user_id,profile_id,all_projects,assigned_by)
    SELECT NEW.team_id, NEW.user_id, p.id, true, NEW.user_id
    FROM public.access_profiles p WHERE p.is_system AND p.name = 'Gestor financeiro'
    ON CONFLICT (team_id,user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.default_owner_finance_profile() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_default_owner_finance_profile ON public.team_members;
CREATE TRIGGER trg_default_owner_finance_profile AFTER INSERT OR UPDATE OF role ON public.team_members
FOR EACH ROW EXECUTE FUNCTION public.default_owner_finance_profile();

INSERT INTO public.member_access_profiles(team_id,user_id,profile_id,all_projects,assigned_by)
SELECT tm.team_id, tm.user_id, p.id, true, tm.user_id
FROM public.team_members tm CROSS JOIN public.access_profiles p
WHERE tm.role = 'admin' AND p.is_system AND p.name = 'Gestor financeiro'
ON CONFLICT (team_id,user_id) DO NOTHING;