
-- Re-grant EXECUTE on all SECURITY DEFINER helper functions used inside RLS policies.
-- A previous hardening migration revoked EXECUTE from authenticated broadly, which
-- silently broke policies that call helpers like get_user_team_ids / is_board_member,
-- making authenticated users appear to have no teams/boards.
DO $$
DECLARE fn text;
  helper_fns text[] := ARRAY[
    'get_user_team_ids','get_user_board_ids','get_board_role','get_team_active_plan','get_team_plan',
    'get_board_service_demand_count','is_team_member','is_team_creator','is_team_admin_or_moderator',
    'is_team_admin_or_moderator_for_board','is_board_member','is_board_admin_or_moderator',
    'is_board_admin_in_team','is_demand_shared','is_folder_owner','is_note_owner','is_note_shared',
    'is_note_shared_with_user','is_project_owner','has_folder_access','has_folder_edit_access',
    'has_project_access','has_project_edit_access','can_edit_note','can_manage_demand_assignees',
    'can_view_demand_channel','verify_demand_share_token'
  ];
  stmt text;
BEGIN
  FOREACH fn IN ARRAY helper_fns LOOP
    SELECT string_agg(format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', p.oid::regprocedure), ' ')
      INTO stmt
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname = fn;
    IF stmt IS NOT NULL THEN EXECUTE stmt; END IF;
  END LOOP;
END $$;
