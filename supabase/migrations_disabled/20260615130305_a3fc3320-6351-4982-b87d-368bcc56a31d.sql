CREATE POLICY "Edit-shared users can create shares"
ON public.project_shares
FOR INSERT
TO authenticated
WITH CHECK (public.has_project_edit_access(auth.uid(), project_id));

CREATE POLICY "Edit-shared users can update shares"
ON public.project_shares
FOR UPDATE
TO authenticated
USING (public.has_project_edit_access(auth.uid(), project_id))
WITH CHECK (public.has_project_edit_access(auth.uid(), project_id));

CREATE POLICY "Edit-shared users can delete shares"
ON public.project_shares
FOR DELETE
TO authenticated
USING (public.has_project_edit_access(auth.uid(), project_id));