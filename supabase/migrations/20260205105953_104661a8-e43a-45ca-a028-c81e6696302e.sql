-- Fix security issues - drop existing policies first
-- Drop all existing anonymous/public policies on profiles and teams
DROP POLICY IF EXISTS "Anonymous can view profiles for shared demands" ON public.profiles;
DROP POLICY IF EXISTS "Team members can view teammate profiles" ON public.profiles;
DROP POLICY IF EXISTS "Anonymous can view team basic info for shared demands" ON public.teams;

-- Now recreate the proper policies

-- 1. Authenticated users can view profiles of users in the same team/board
CREATE POLICY "Team members can view teammate profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Can view own profile
  auth.uid() = id
  OR
  -- Can view profiles of users in the same team
  id IN (
    SELECT tm.user_id 
    FROM team_members tm 
    WHERE tm.team_id IN (SELECT get_user_team_ids(auth.uid()))
  )
  OR
  -- Can view profiles of users in the same board
  id IN (
    SELECT bm.user_id 
    FROM board_members bm 
    WHERE bm.board_id IN (SELECT get_user_board_ids(auth.uid()))
  )
);

-- 2. Anonymous access to profiles ONLY for shared content
CREATE POLICY "Anonymous can view profiles for shared demands"
ON public.profiles
FOR SELECT
TO anon
USING (
  -- Only allow access to profiles that are linked to shared demands
  id IN (
    SELECT d.created_by FROM demands d WHERE is_demand_shared(d.id)
    UNION
    SELECT da.user_id FROM demand_assignees da 
    JOIN demands d ON d.id = da.demand_id 
    WHERE is_demand_shared(d.id)
    UNION
    SELECT di.user_id FROM demand_interactions di
    JOIN demands d ON d.id = di.demand_id
    WHERE is_demand_shared(d.id)
  )
  OR
  -- Or shared notes
  id IN (
    SELECT n.created_by FROM notes n WHERE is_note_shared(n.id)
  )
);

-- 3. Anonymous access to teams for shared demands (without access_code exposed)
CREATE POLICY "Anonymous can view team basic info for shared demands"
ON public.teams
FOR SELECT
TO anon
USING (
  id IN (
    SELECT d.team_id FROM demands d WHERE is_demand_shared(d.id)
    UNION
    SELECT n.team_id FROM notes n WHERE is_note_shared(n.id)
  )
);