
CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = _team_id AND t.created_by = _user_id)
$$;

DROP POLICY IF EXISTS "Board admins can delete board_statuses" ON public.board_statuses;
DROP POLICY IF EXISTS "Team admins/moderators can delete board_statuses" ON public.board_statuses;
DROP POLICY IF EXISTS "Board admins can insert board_statuses" ON public.board_statuses;
DROP POLICY IF EXISTS "Board members can view board_statuses" ON public.board_statuses;
DROP POLICY IF EXISTS "Team admins/moderators can view board_statuses" ON public.board_statuses;
DROP POLICY IF EXISTS "Board admins can update board_statuses" ON public.board_statuses;
DROP POLICY IF EXISTS "Team admins/moderators can update board_statuses" ON public.board_statuses;

CREATE POLICY "board_statuses_select" ON public.board_statuses FOR SELECT TO authenticated
  USING (public.is_board_member(auth.uid(), board_id) OR public.is_team_admin_or_moderator_for_board(auth.uid(), board_id));
CREATE POLICY "board_statuses_insert" ON public.board_statuses FOR INSERT TO authenticated
  WITH CHECK (public.is_board_admin_or_moderator(auth.uid(), board_id) OR public.is_team_admin_or_moderator_for_board(auth.uid(), board_id));
CREATE POLICY "board_statuses_update" ON public.board_statuses FOR UPDATE TO authenticated
  USING (public.is_board_admin_or_moderator(auth.uid(), board_id) OR public.is_team_admin_or_moderator_for_board(auth.uid(), board_id))
  WITH CHECK (public.is_board_admin_or_moderator(auth.uid(), board_id) OR public.is_team_admin_or_moderator_for_board(auth.uid(), board_id));
CREATE POLICY "board_statuses_delete" ON public.board_statuses FOR DELETE TO authenticated
  USING (public.is_board_admin_or_moderator(auth.uid(), board_id) OR public.is_team_admin_or_moderator_for_board(auth.uid(), board_id));

REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, full_name, avatar_url, job_title, bio, banner_url, banner_gradient) ON public.profiles TO anon;

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view inline images" ON storage.objects;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure::text AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;

DO $$
DECLARE fn text;
  anon_fns text[] := ARRAY[
    'check_access_code_exists','email_exists','get_shared_board_summary',
    'get_team_by_access_code','get_user_id_by_email','join_board_via_share_token',
    'password_reset_required','verify_note_share_token'
  ];
  stmt text;
BEGIN
  FOREACH fn IN ARRAY anon_fns LOOP
    SELECT string_agg(format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated;', p.oid::regprocedure), ' ')
      INTO stmt
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname = fn;
    IF stmt IS NOT NULL THEN EXECUTE stmt; END IF;
  END LOOP;
END $$;

DO $$
DECLARE fn text;
  auth_fns text[] := ARRAY[
    'can_create_demand','can_create_demand_with_service','check_plan_limit','check_subscription_limit',
    'clear_password_reset_required','create_approval_notifications','create_board_membership_notification',
    'create_board_with_services','create_demand_with_subdemands','get_join_request_profiles',
    'get_monthly_demand_count','has_role','has_board_role','has_team_role','is_team_admin',
    'is_team_owner','join_team_with_code','propagate_status_to_subdemands','redeem_trial_coupon',
    'reorder_subdemands','update_trial_coupon'
  ];
  stmt text;
BEGIN
  FOREACH fn IN ARRAY auth_fns LOOP
    SELECT string_agg(format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', p.oid::regprocedure), ' ')
      INTO stmt
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname = fn;
    IF stmt IS NOT NULL THEN EXECUTE stmt; END IF;
  END LOOP;
END $$;
