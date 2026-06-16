
-- Add SELECT policy for team admins/moderators on board_statuses
CREATE POLICY "Team admins/moderators can view board_statuses"
ON public.board_statuses
FOR SELECT
TO authenticated
USING (is_team_admin_or_moderator_for_board(auth.uid(), board_id));

-- Add UPDATE policy for team admins/moderators on board_statuses
CREATE POLICY "Team admins/moderators can update board_statuses"
ON public.board_statuses
FOR UPDATE
TO authenticated
USING (is_team_admin_or_moderator_for_board(auth.uid(), board_id));

-- Add DELETE policy for team admins/moderators on board_statuses
CREATE POLICY "Team admins/moderators can delete board_statuses"
ON public.board_statuses
FOR DELETE
TO authenticated
USING (is_team_admin_or_moderator_for_board(auth.uid(), board_id));
