CREATE POLICY "Folder owner can update shares"
ON public.demand_folder_shares
FOR UPDATE
TO authenticated
USING (is_folder_owner(auth.uid(), folder_id))
WITH CHECK (is_folder_owner(auth.uid(), folder_id));