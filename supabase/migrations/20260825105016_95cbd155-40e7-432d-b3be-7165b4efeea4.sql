DO $$
DECLARE
  fn text;
  auth_fns text[] := ARRAY[
    'get_user_board_ids',
    'get_user_team_ids',
    'has_role',
    'is_team_member',
    'is_note_shared_with_user'
  ];
  stmt text;
BEGIN
  FOREACH fn IN ARRAY auth_fns LOOP
    SELECT string_agg(format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role, authenticator;', p.oid::regprocedure), ' ')
      INTO stmt
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = fn;

    IF stmt IS NOT NULL THEN
      EXECUTE stmt;
    END IF;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.verify_note_share_token(text) TO anon, authenticated, service_role, authenticator;

GRANT SELECT (id, full_name, avatar_url, job_title, bio, banner_url, banner_gradient) ON public.profiles TO anon;
GRANT SELECT ON public.profiles TO authenticated, service_role;