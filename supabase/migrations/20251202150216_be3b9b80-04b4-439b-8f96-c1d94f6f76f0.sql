-- First, drop all potentially restrictive policies
DROP POLICY IF EXISTS "Admins can create teams" ON public.teams;
DROP POLICY IF EXISTS "Users can join teams with access code" ON public.team_members;

-- Recreate teams INSERT policy as PERMISSIVE (explicit)
CREATE POLICY "Admins can create teams"
ON public.teams
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Recreate team_members INSERT policy as PERMISSIVE
CREATE POLICY "Users can join teams with access code"
ON public.team_members
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);