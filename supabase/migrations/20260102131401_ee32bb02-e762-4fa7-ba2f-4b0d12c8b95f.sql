-- Drop the problematic UPDATE policy
DROP POLICY IF EXISTS "Team admins can update member roles" ON public.team_members;

-- Create a new policy using the security definer function to avoid recursion
CREATE POLICY "Team admins can update member roles" 
ON public.team_members 
FOR UPDATE 
USING (public.has_team_role(auth.uid(), team_id, 'admin'))
WITH CHECK (public.has_team_role(auth.uid(), team_id, 'admin'));