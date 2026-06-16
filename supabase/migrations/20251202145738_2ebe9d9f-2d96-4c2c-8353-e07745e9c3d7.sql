-- Drop problematic RLS policies
DROP POLICY IF EXISTS "Users can view team members of their teams" ON public.team_members;
DROP POLICY IF EXISTS "Team members can view demands" ON public.demands;
DROP POLICY IF EXISTS "Team members can create demands" ON public.demands;
DROP POLICY IF EXISTS "Team members can update demands" ON public.demands;

-- Create security definer function to check team membership without recursion
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
  )
$$;

-- Create security definer function to get user's team IDs
CREATE OR REPLACE FUNCTION public.get_user_team_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id
  FROM public.team_members
  WHERE user_id = _user_id
$$;

-- Recreate team_members policies using the security definer function
CREATE POLICY "Users can view team members of their teams"
ON public.team_members
FOR SELECT
USING (team_id IN (SELECT public.get_user_team_ids(auth.uid())));

-- Recreate demands policies using the security definer function
CREATE POLICY "Team members can view demands"
ON public.demands
FOR SELECT
USING (team_id IN (SELECT public.get_user_team_ids(auth.uid())));

CREATE POLICY "Team members can create demands"
ON public.demands
FOR INSERT
WITH CHECK (team_id IN (SELECT public.get_user_team_ids(auth.uid())));

CREATE POLICY "Team members can update demands"
ON public.demands
FOR UPDATE
USING (team_id IN (SELECT public.get_user_team_ids(auth.uid())));