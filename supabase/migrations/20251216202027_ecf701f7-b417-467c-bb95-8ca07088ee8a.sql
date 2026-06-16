-- Fix boards INSERT policy: use SECURITY DEFINER function to avoid ambiguous column capture

DROP POLICY IF EXISTS "Team admins/moderators can create boards" ON public.boards;

CREATE POLICY "Team admins/moderators can create boards"
ON public.boards
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_team_admin_or_moderator(auth.uid(), team_id)
);
