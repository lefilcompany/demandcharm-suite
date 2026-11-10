CREATE TABLE public.access_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  system_key text,
  name text NOT NULL,
  description text,
  permissions text[] NOT NULL DEFAULT '{}',
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((is_system AND team_id IS NULL AND system_key IS NOT NULL) OR (NOT is_system AND team_id IS NOT NULL))
);
CREATE UNIQUE INDEX access_profiles_system_key ON public.access_profiles(system_key) WHERE is_system;
CREATE UNIQUE INDEX access_profiles_team_name ON public.access_profiles(team_id, lower(name)) WHERE team_id IS NOT NULL;
GRANT SELECT ON public.access_profiles TO authenticated;
GRANT ALL ON public.access_profiles TO service_role;
ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY ap_select ON public.access_profiles FOR SELECT TO authenticated
  USING (team_id IS NULL OR public.is_team_member((select auth.uid()), team_id) OR public.has_role((select auth.uid()), 'admin'));

CREATE TABLE public.member_access_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.access_profiles(id) ON DELETE RESTRICT,
  all_projects boolean NOT NULL DEFAULT true,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
CREATE INDEX map_user_idx ON public.member_access_profiles(user_id, team_id);
GRANT SELECT ON public.member_access_profiles TO authenticated;
GRANT ALL ON public.member_access_profiles TO service_role;
ALTER TABLE public.member_access_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY map_select ON public.member_access_profiles FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.can_manage_finance_access((select auth.uid()), team_id));

CREATE TABLE public.member_access_project_scope (
  assignment_id uuid NOT NULL REFERENCES public.member_access_profiles(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  PRIMARY KEY (assignment_id, project_id)
);
CREATE INDEX maps_project_idx ON public.member_access_project_scope(project_id);
GRANT SELECT ON public.member_access_project_scope TO authenticated;
GRANT ALL ON public.member_access_project_scope TO service_role;
ALTER TABLE public.member_access_project_scope ENABLE ROW LEVEL SECURITY;
CREATE POLICY maps_select ON public.member_access_project_scope FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.member_access_profiles m WHERE m.id = assignment_id
    AND (m.user_id = (select auth.uid()) OR public.can_manage_finance_access((select auth.uid()), m.team_id))));

INSERT INTO public.access_profiles(system_key, name, description, permissions, is_system) VALUES
 ('none','Sem acesso','Não vê nada do financeiro nem de projetos.','{}',true),
 ('finance_reader','Leitor financeiro','Vê resultados e margens dos projetos.','{finance.view_team,finance.view_board,finance.view_project,projects.view,reports.view}',true),
 ('finance_analyst','Analista financeiro','Leitura + composição dos custos e exportação.','{finance.view_team,finance.view_board,finance.view_project,finance.view_cost_details,finance.export,projects.view,reports.view}',true),
 ('finance_manager','Gestor financeiro','Tudo do financeiro, inclusive custo por pessoa e fechar o mês.','{finance.view_team,finance.view_board,finance.view_project,finance.view_cost_details,finance.view_employee_costs,finance.manage_revenue,finance.manage_expenses,finance.manage_allocations,finance.manage_settings,finance.export,finance.close_period,projects.view,projects.edit,reports.view}',true),
 ('project_manager','Gestor de projetos','Vê e edita projetos e relatórios, sem números financeiros.','{projects.view,projects.edit,reports.view}',true);

-- Member kind across the platform
ALTER TABLE public.team_members ADD COLUMN member_kind text NOT NULL DEFAULT 'internal'
  CHECK (member_kind IN ('internal','client_external','contractor'));
UPDATE public.team_members tm SET member_kind = f.kind
FROM public.finance_member_profiles f
WHERE f.team_id = tm.team_id AND f.user_id = tm.user_id AND f.valid_from <= current_date
  AND (f.valid_to IS NULL OR f.valid_to >= current_date) AND f.kind IN ('internal','client_external','contractor');

-- Permission check: legacy grants OR access profile (with project scope)
CREATE OR REPLACE FUNCTION public.profile_grants(_user_id uuid, _team_id uuid, _permission text, _board_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.member_access_profiles m JOIN public.access_profiles p ON p.id = m.profile_id
    WHERE m.user_id = _user_id AND m.team_id = _team_id AND _permission = ANY(p.permissions)
      AND (m.all_projects OR (_board_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.member_access_project_scope s JOIN public.project_boards pb ON pb.project_id = s.project_id
        WHERE s.assignment_id = m.id AND pb.board_id = _board_id AND (pb.valid_to IS NULL OR pb.valid_to >= current_date))))
  )
$$;
REVOKE EXECUTE ON FUNCTION public.profile_grants(uuid,uuid,text,uuid) FROM anon, public;

CREATE OR REPLACE FUNCTION public.has_finance_permission(_user_id uuid, _permission text, _team_id uuid, _board_id uuid DEFAULT NULL::uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user_id IS NULL THEN false
    WHEN public.has_role(_user_id, 'admin') THEN true
    WHEN NOT public.is_team_member(_user_id, _team_id) THEN false
    WHEN _board_id IS NOT NULL AND (
      NOT EXISTS (SELECT 1 FROM public.boards b WHERE b.id = _board_id AND b.team_id = _team_id)
      OR EXISTS (SELECT 1 FROM public.board_members bm WHERE bm.board_id = _board_id AND bm.user_id = _user_id AND bm.role::text = 'requester')
    ) THEN false
    WHEN public.profile_grants(_user_id, _team_id, _permission, _board_id) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.finance_permissions fp
      WHERE fp.user_id = _user_id AND fp.team_id = _team_id AND fp.permission = _permission AND fp.revoked_at IS NULL
        AND (fp.board_id IS NULL OR (_board_id IS NOT NULL AND fp.board_id = _board_id
              AND EXISTS (SELECT 1 FROM public.board_members bm WHERE bm.board_id = _board_id AND bm.user_id = _user_id))))
  END
$function$;

CREATE OR REPLACE FUNCTION public.has_module_permission(_user_id uuid, _team_id uuid, _permission text, _project_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL AND (public.has_role(_user_id,'admin') OR public.is_team_admin(_user_id,_team_id) OR EXISTS (
    SELECT 1 FROM public.member_access_profiles m JOIN public.access_profiles p ON p.id = m.profile_id
    WHERE m.user_id = _user_id AND m.team_id = _team_id AND _permission = ANY(p.permissions)
      AND (m.all_projects OR (_project_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.member_access_project_scope s WHERE s.assignment_id = m.id AND s.project_id = _project_id)))))
$$;
REVOKE EXECUTE ON FUNCTION public.has_module_permission(uuid,uuid,text,uuid) FROM anon, public;

CREATE OR REPLACE FUNCTION public.get_my_finance_access(_team_id uuid)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() AS uid),
  prof AS (SELECT m.id, m.all_projects, p.permissions FROM public.member_access_profiles m JOIN public.access_profiles p ON p.id = m.profile_id, me
           WHERE m.user_id = me.uid AND m.team_id = _team_id)
  SELECT jsonb_build_object(
    'is_global_admin', public.has_role((SELECT uid FROM me), 'admin'),
    'is_team_owner', public.is_team_admin((SELECT uid FROM me), _team_id),
    'team_permissions', COALESCE((SELECT jsonb_agg(DISTINCT x) FROM (
        SELECT permission x FROM public.finance_permissions, me WHERE user_id = me.uid AND team_id = _team_id AND board_id IS NULL AND revoked_at IS NULL
        UNION SELECT unnest(permissions) FROM prof WHERE all_projects) q WHERE x LIKE 'finance.%'), '[]'::jsonb),
    'board_permissions', COALESCE((SELECT jsonb_agg(jsonb_build_object('board_id', b, 'permission', pm)) FROM (
        SELECT fp.board_id b, fp.permission pm FROM public.finance_permissions fp JOIN public.board_members bm ON bm.board_id = fp.board_id AND bm.user_id = fp.user_id AND bm.role::text <> 'requester', me
          WHERE fp.user_id = me.uid AND fp.team_id = _team_id AND fp.board_id IS NOT NULL AND fp.revoked_at IS NULL
        UNION
        SELECT DISTINCT pb.board_id, unnest(prof.permissions) FROM prof JOIN public.member_access_project_scope s ON s.assignment_id = prof.id
          JOIN public.project_boards pb ON pb.project_id = s.project_id AND (pb.valid_to IS NULL OR pb.valid_to >= current_date)
          WHERE NOT prof.all_projects AND NOT EXISTS (SELECT 1 FROM public.board_members bm, me WHERE bm.board_id = pb.board_id AND bm.user_id = me.uid AND bm.role::text = 'requester')
      ) q WHERE pm LIKE 'finance.%'), '[]'::jsonb)
  ) WHERE public.is_team_member(auth.uid(), _team_id) OR public.has_role(auth.uid(), 'admin')
$function$;

CREATE OR REPLACE FUNCTION public.upsert_access_profile(_team_id uuid, _id uuid, _name text, _description text, _permissions text[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _rid uuid; _bad text;
BEGIN
  IF NOT public.can_manage_finance_access(_me, _team_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF coalesce(trim(_name),'') = '' THEN RAISE EXCEPTION 'NAME_REQUIRED'; END IF;
  SELECT x INTO _bad FROM unnest(_permissions) x WHERE x NOT IN ('finance.view_team','finance.view_board','finance.view_project','finance.view_cost_details','finance.view_employee_costs','finance.manage_revenue','finance.manage_expenses','finance.manage_allocations','finance.manage_settings','finance.export','finance.close_period','projects.view','projects.edit','reports.view') LIMIT 1;
  IF _bad IS NOT NULL THEN RAISE EXCEPTION 'UNKNOWN_PERMISSION %', _bad; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.access_profiles(team_id,name,description,permissions,created_by) VALUES (_team_id,trim(_name),_description,_permissions,_me) RETURNING id INTO _rid;
  ELSE
    UPDATE public.access_profiles SET name=trim(_name), description=_description, permissions=_permissions, updated_at=now()
      WHERE id=_id AND team_id=_team_id AND NOT is_system RETURNING id INTO _rid;
    IF _rid IS NULL THEN RAISE EXCEPTION 'PROFILE_NOT_EDITABLE'; END IF;
  END IF;
  INSERT INTO public.finance_audit_log(team_id,actor_id,action,entity,entity_id,after_data)
  VALUES (_team_id,_me,CASE WHEN _id IS NULL THEN 'create' ELSE 'update' END,'access_profiles',_rid,jsonb_build_object('name',_name,'permissions',_permissions));
  RETURN _rid;
END $$;

CREATE OR REPLACE FUNCTION public.delete_access_profile(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _team uuid;
BEGIN
  SELECT team_id INTO _team FROM public.access_profiles WHERE id=_id AND NOT is_system;
  IF _team IS NULL THEN RAISE EXCEPTION 'PROFILE_NOT_EDITABLE'; END IF;
  IF NOT public.can_manage_finance_access(_me, _team) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF EXISTS (SELECT 1 FROM public.member_access_profiles WHERE profile_id=_id) THEN RAISE EXCEPTION 'PROFILE_IN_USE'; END IF;
  DELETE FROM public.access_profiles WHERE id=_id;
  INSERT INTO public.finance_audit_log(team_id,actor_id,action,entity,entity_id) VALUES (_team,_me,'delete','access_profiles',_id);
END $$;

CREATE OR REPLACE FUNCTION public.assign_access_profile(_team_id uuid, _user_id uuid, _profile_id uuid, _all_projects boolean, _project_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _perms text[]; _kind text; _role text; _aid uuid;
BEGIN
  IF NOT public.can_manage_finance_access(_me, _team_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _me = _user_id AND NOT public.has_role(_me,'admin') THEN RAISE EXCEPTION 'CANNOT_GRANT_SELF'; END IF;
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
  ON CONFLICT (team_id,user_id) DO UPDATE SET profile_id=EXCLUDED.profile_id, all_projects=EXCLUDED.all_projects, assigned_by=_me, assigned_at=now()
  RETURNING id INTO _aid;
  DELETE FROM public.member_access_project_scope WHERE assignment_id=_aid;
  IF NOT _all_projects THEN
    INSERT INTO public.member_access_project_scope(assignment_id,project_id) SELECT _aid, unnest(coalesce(_project_ids,'{}')) ON CONFLICT DO NOTHING;
  END IF;
  UPDATE public.finance_permissions SET revoked_at=now(), revoked_by=_me WHERE team_id=_team_id AND user_id=_user_id AND revoked_at IS NULL;
  INSERT INTO public.finance_audit_log(team_id,actor_id,action,entity,entity_id,after_data)
  VALUES (_team_id,_me,'assign','member_access_profiles',_aid,jsonb_build_object('user_id',_user_id,'profile_id',_profile_id,'all_projects',_all_projects,'project_ids',_project_ids));
  RETURN _aid;
END $$;

CREATE OR REPLACE FUNCTION public.set_member_kind(_team_id uuid, _user_id uuid, _kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _old text;
BEGIN
  IF NOT public.can_manage_finance_access(_me, _team_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF _kind NOT IN ('internal','client_external','contractor') THEN RAISE EXCEPTION 'INVALID_KIND'; END IF;
  SELECT member_kind INTO _old FROM public.team_members WHERE team_id=_team_id AND user_id=_user_id;
  IF _old IS NULL THEN RAISE EXCEPTION 'USER_NOT_IN_TEAM'; END IF;
  IF _kind = 'client_external' AND EXISTS (SELECT 1 FROM public.member_access_profiles m JOIN public.access_profiles p ON p.id=m.profile_id
     WHERE m.team_id=_team_id AND m.user_id=_user_id AND EXISTS (SELECT 1 FROM unnest(p.permissions) x WHERE x LIKE 'finance.%')) THEN
    RAISE EXCEPTION 'REMOVE_FINANCE_PROFILE_FIRST';
  END IF;
  UPDATE public.team_members SET member_kind=_kind WHERE team_id=_team_id AND user_id=_user_id;
  INSERT INTO public.finance_audit_log(team_id,actor_id,action,entity,before_data,after_data)
  VALUES (_team_id,_me,'set_kind','team_members',jsonb_build_object('user_id',_user_id,'kind',_old),jsonb_build_object('user_id',_user_id,'kind',_kind));
END $$;

REVOKE EXECUTE ON FUNCTION public.upsert_access_profile(uuid,uuid,text,text,text[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.delete_access_profile(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.assign_access_profile(uuid,uuid,uuid,boolean,uuid[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.set_member_kind(uuid,uuid,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.upsert_access_profile(uuid,uuid,text,text,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_access_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.assign_access_profile(uuid,uuid,uuid,boolean,uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_member_kind(uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_module_permission(uuid,uuid,text,uuid) TO authenticated;

COMMENT ON TABLE public.finance_permissions IS 'DEPRECATED: replaced by access_profiles + member_access_profiles; still read as legacy fallback';