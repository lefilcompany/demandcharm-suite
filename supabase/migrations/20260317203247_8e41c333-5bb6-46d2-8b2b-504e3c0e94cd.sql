
-- Add missing INSERT policy for boards table
CREATE POLICY "Team admins/moderators can create boards"
ON public.boards FOR INSERT
TO authenticated
WITH CHECK (is_team_admin_or_moderator(auth.uid(), team_id));
