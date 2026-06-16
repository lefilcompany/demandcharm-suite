-- Drop the problematic DELETE policy that has recursive query
DROP POLICY IF EXISTS "Team admins can remove members" ON public.team_members;

-- Create a new policy using the security definer function to avoid recursion
CREATE POLICY "Team admins can remove members" 
ON public.team_members 
FOR DELETE 
USING (public.has_team_role(auth.uid(), team_id, 'admin'));