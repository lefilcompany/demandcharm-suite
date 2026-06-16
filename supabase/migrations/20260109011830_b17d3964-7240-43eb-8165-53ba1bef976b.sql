-- Fix boards INSERT RLS by avoiding function call and using direct EXISTS check

DROP POLICY IF EXISTS "Team admins/moderators can create boards" ON public.boards;

CREATE POLICY "Team admins/moderators can create boards"
ON public.boards
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1
    FROM public.team_members tm
    WHERE tm.team_id = team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('admin'::public.team_role, 'moderator'::public.team_role)
  )
);
