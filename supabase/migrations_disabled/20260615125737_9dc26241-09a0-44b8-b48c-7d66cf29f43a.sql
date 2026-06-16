CREATE POLICY "Edit-shared users can update projects"
ON public.projects
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.project_shares ps
    WHERE ps.project_id = projects.id
      AND ps.user_id = auth.uid()
      AND ps.permission = 'edit'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_shares ps
    WHERE ps.project_id = projects.id
      AND ps.user_id = auth.uid()
      AND ps.permission = 'edit'
  )
);