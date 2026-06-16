-- Fix boards INSERT RLS: require creator match + explicit admin/moderator role
DROP POLICY IF EXISTS "Team admins/moderators can create boards" ON public.boards;

CREATE POLICY "Team admins/moderators can create boards"
ON public.boards
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (
    public.has_team_role(auth.uid(), team_id, 'admin'::team_role)
    OR public.has_team_role(auth.uid(), team_id, 'moderator'::team_role)
  )
);
