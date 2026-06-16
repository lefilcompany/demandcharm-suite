
-- Fix the broken SELECT policy on demand_folders
-- The old policy compared demand_folder_shares.folder_id to demand_folder_shares.id (wrong!)
-- It should compare demand_folder_shares.folder_id to demand_folders.id

DROP POLICY IF EXISTS "Owner or shared users can view folders" ON public.demand_folders;

CREATE POLICY "Owner or shared users can view folders"
ON public.demand_folders
FOR SELECT
TO public
USING (
  (created_by = auth.uid()) 
  OR EXISTS (
    SELECT 1 FROM demand_folder_shares dfs
    WHERE dfs.folder_id = demand_folders.id AND dfs.user_id = auth.uid()
  )
);
