-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Team admins/moderators can create boards" ON public.boards;
DROP POLICY IF EXISTS "Board admins/moderators can update boards" ON public.boards;
DROP POLICY IF EXISTS "Team admins can delete non-default boards" ON public.boards;
DROP POLICY IF EXISTS "Members can view their boards" ON public.boards;

-- Recreate as PERMISSIVE policies (default)
CREATE POLICY "Team admins/moderators can create boards" 
ON public.boards 
FOR INSERT 
TO authenticated
WITH CHECK (is_team_admin_or_moderator(auth.uid(), team_id));

CREATE POLICY "Board admins/moderators can update boards" 
ON public.boards 
FOR UPDATE 
TO authenticated
USING (is_board_admin_or_moderator(auth.uid(), id));

CREATE POLICY "Team admins can delete non-default boards" 
ON public.boards 
FOR DELETE 
TO authenticated
USING (is_team_admin_or_moderator(auth.uid(), team_id) AND is_default = false);

CREATE POLICY "Members can view their boards" 
ON public.boards 
FOR SELECT 
TO authenticated
USING (id IN (SELECT get_user_board_ids(auth.uid())));