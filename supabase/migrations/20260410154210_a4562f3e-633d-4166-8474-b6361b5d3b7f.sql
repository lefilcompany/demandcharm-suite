
-- Create a helper function to check if user has edit access to a folder (owner OR shared with edit permission)
CREATE OR REPLACE FUNCTION public.has_folder_edit_access(_user_id uuid, _folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM demand_folders WHERE id = _folder_id AND created_by = _user_id
  ) OR EXISTS (
    SELECT 1 FROM demand_folder_shares 
    WHERE folder_id = _folder_id AND user_id = _user_id AND permission = 'edit'
  )
$$;

-- Drop old INSERT policy (owner only)
DROP POLICY IF EXISTS "Folder owner can add items" ON public.demand_folder_items;

-- Create new INSERT policy (owner OR shared with edit)
CREATE POLICY "Folder owner or editor can add items"
ON public.demand_folder_items
FOR INSERT
TO public
WITH CHECK (has_folder_edit_access(auth.uid(), folder_id));

-- Drop old DELETE policy (owner only)
DROP POLICY IF EXISTS "Folder owner can remove items" ON public.demand_folder_items;

-- Create new DELETE policy (owner OR shared with edit)
CREATE POLICY "Folder owner or editor can remove items"
ON public.demand_folder_items
FOR DELETE
TO public
USING (has_folder_edit_access(auth.uid(), folder_id));
