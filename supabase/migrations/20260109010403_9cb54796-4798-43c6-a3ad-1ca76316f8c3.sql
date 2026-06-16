-- Drop the incorrect policy
DROP POLICY IF EXISTS "Team admins/moderators can create boards" ON public.boards;

-- Create corrected policy with proper parameter order
-- is_team_admin_or_moderator expects (_user_id, _team_id)
CREATE POLICY "Team admins/moderators can create boards"
ON public.boards
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND is_team_admin_or_moderator(auth.uid(), team_id)
);