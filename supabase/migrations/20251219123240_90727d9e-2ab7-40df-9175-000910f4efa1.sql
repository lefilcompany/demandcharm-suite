-- Create a function to check if user is admin/moderator in any board of a team
CREATE OR REPLACE FUNCTION public.is_board_admin_in_team(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.board_members bm
    JOIN public.boards b ON b.id = bm.board_id
    WHERE bm.user_id = _user_id
      AND b.team_id = _team_id
      AND bm.role IN ('admin', 'moderator')
  )
$$;

-- Drop existing policy
DROP POLICY IF EXISTS "Team admins/moderators can create boards" ON public.boards;

-- Create new policy that also allows board admins to create new boards
CREATE POLICY "Team admins/moderators can create boards"
ON public.boards
FOR INSERT
WITH CHECK (
  (auth.uid() = created_by) 
  AND (
    has_team_role(auth.uid(), team_id, 'admin'::team_role) 
    OR has_team_role(auth.uid(), team_id, 'moderator'::team_role)
    OR is_board_admin_in_team(auth.uid(), team_id)
  )
);