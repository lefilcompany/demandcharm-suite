-- Fix boards INSERT RLS policy to avoid table-qualified NEW-row refs

DROP POLICY IF EXISTS "Team admins/moderators can create boards" ON public.boards;

CREATE POLICY "Team admins/moderators can create boards"
ON public.boards
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.team_id = team_id
      AND tm.role IN ('admin'::public.team_role, 'moderator'::public.team_role)
  )
);
