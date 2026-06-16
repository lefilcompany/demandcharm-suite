-- Fix: qualify function in boards INSERT RLS policy (avoid search_path/overload issues)

DROP POLICY IF EXISTS "Team admins/moderators can create boards" ON public.boards;

CREATE POLICY "Team admins/moderators can create boards"
ON public.boards
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_team_admin_or_moderator(auth.uid(), team_id)
);
