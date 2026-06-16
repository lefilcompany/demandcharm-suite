-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Admins can create teams" ON public.teams;

CREATE POLICY "Admins can create teams"
ON public.teams
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));