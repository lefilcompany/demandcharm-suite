CREATE OR REPLACE FUNCTION public.can_manage_finance_access(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR public.is_team_admin(_user_id, _team_id)
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_finance_access(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_manage_finance_access(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.grant_finance_permission(_team_id uuid, _user_id uuid, _permission text, _board_id uuid DEFAULT NULL::uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  IF NOT public.has_role(_me, 'admin') THEN
    IF _me = _user_id THEN RAISE EXCEPTION 'CANNOT_GRANT_SELF'; END IF;
    IF NOT public.is_team_admin(_me, _team_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  END IF;
  IF NOT public.is_team_member(_user_id, _team_id) THEN RAISE EXCEPTION 'USER_NOT_IN_TEAM'; END IF;
  IF _board_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.board_members WHERE board_id = _board_id AND user_id = _user_id AND role::text <> 'requester') THEN
    RAISE EXCEPTION 'USER_NOT_ON_BOARD';
  END IF;
  SELECT id INTO _id FROM public.finance_permissions WHERE team_id = _team_id AND user_id = _user_id AND permission = _permission
    AND board_id IS NOT DISTINCT FROM _board_id AND revoked_at IS NULL;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  INSERT INTO public.finance_permissions(team_id, board_id, user_id, permission, granted_by)
  VALUES (_team_id, _board_id, _user_id, _permission, _me) RETURNING id INTO _id;
  INSERT INTO public.finance_audit_log(team_id, actor_id, action, entity, entity_id, after_data)
  VALUES (_team_id, _me, 'grant', 'finance_permissions', _id, jsonb_build_object('user_id', _user_id, 'permission', _permission, 'board_id', _board_id));
  RETURN _id;
END $function$;

CREATE OR REPLACE FUNCTION public.revoke_finance_permission(_permission_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _me uuid := auth.uid(); _row public.finance_permissions;
BEGIN
  SELECT * INTO _row FROM public.finance_permissions WHERE id = _permission_id AND revoked_at IS NULL;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT public.can_manage_finance_access(_me, _row.team_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  UPDATE public.finance_permissions SET revoked_at = now(), revoked_by = _me WHERE id = _permission_id;
  INSERT INTO public.finance_audit_log(team_id, actor_id, action, entity, entity_id, before_data)
  VALUES (_row.team_id, _me, 'revoke', 'finance_permissions', _row.id, to_jsonb(_row));
END $function$;

DROP POLICY IF EXISTS fp_select ON public.finance_permissions;
CREATE POLICY fp_select ON public.finance_permissions FOR SELECT TO authenticated
USING (user_id = (select auth.uid())
  OR public.can_manage_finance_access((select auth.uid()), team_id)
  OR public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL));