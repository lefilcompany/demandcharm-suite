
-- Force column type change within migration to avoid schema diff conflict
-- This is idempotent: only runs if column is still team_role
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'team_members' 
    AND column_name = 'role' 
    AND udt_name = 'team_role'
  ) THEN
    -- Drop ALL policies that reference team_members.role with team_role cast
    EXECUTE 'DROP POLICY IF EXISTS "Team admins can delete teams" ON public.teams';
    EXECUTE 'DROP POLICY IF EXISTS "Team admins can add members" ON public.team_members';
    EXECUTE 'DROP POLICY IF EXISTS "Team admins can remove members" ON public.team_members';
    EXECUTE 'DROP POLICY IF EXISTS "Team admins can update member roles" ON public.team_members';
    EXECUTE 'DROP POLICY IF EXISTS "Team creators can add self as admin" ON public.team_members';
    EXECUTE 'DROP POLICY IF EXISTS "Users can join teams with access code" ON public.team_members';
    EXECUTE 'DROP POLICY IF EXISTS "Anonymous can view team basic info for shared demands" ON public.teams';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can view team info for shared content" ON public.teams';

    -- Now alter the column type
    ALTER TABLE public.team_members ALTER COLUMN role TYPE public.team_membership_role 
      USING CASE role::text
        WHEN 'admin' THEN 'owner'::public.team_membership_role
        WHEN 'moderator' THEN 'owner'::public.team_membership_role
        WHEN 'executor' THEN 'member'::public.team_membership_role
        WHEN 'requester' THEN 'member'::public.team_membership_role
        ELSE 'member'::public.team_membership_role
      END;
    ALTER TABLE public.team_members ALTER COLUMN role SET DEFAULT 'member'::public.team_membership_role;

    -- Recreate the teams delete policy with function-based check
    EXECUTE 'CREATE POLICY "Team owners can delete teams" ON public.teams FOR DELETE TO authenticated USING (public.is_team_owner(auth.uid(), id))';
  END IF;
END$$;
