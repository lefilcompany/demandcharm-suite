
-- Create demand_folder_shares table
CREATE TABLE public.demand_folder_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID NOT NULL REFERENCES public.demand_folders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(folder_id, user_id)
);

ALTER TABLE public.demand_folder_shares ENABLE ROW LEVEL SECURITY;

-- Helper function to check folder ownership
CREATE OR REPLACE FUNCTION public.is_folder_owner(_user_id uuid, _folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.demand_folders
    WHERE id = _folder_id AND created_by = _user_id
  )
$$;

-- Helper function to check folder access (owner or shared)
CREATE OR REPLACE FUNCTION public.has_folder_access(_user_id uuid, _folder_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.demand_folders
    WHERE id = _folder_id AND created_by = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.demand_folder_shares
    WHERE folder_id = _folder_id AND user_id = _user_id
  )
$$;

-- ==========================================
-- Update demand_folders RLS
-- ==========================================
DROP POLICY "Team members can view folders" ON public.demand_folders;
DROP POLICY "Team members can create folders" ON public.demand_folders;
DROP POLICY "Team members can update folders" ON public.demand_folders;
DROP POLICY "Creator or team owner can delete folders" ON public.demand_folders;

-- Only creator or shared users can view
CREATE POLICY "Owner or shared users can view folders"
  ON public.demand_folders FOR SELECT
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.demand_folder_shares
      WHERE folder_id = id AND user_id = auth.uid()
    )
  );

-- Only the user themselves can create folders
CREATE POLICY "Users can create own folders"
  ON public.demand_folders FOR INSERT
  WITH CHECK (
    is_team_member(auth.uid(), team_id)
    AND created_by = auth.uid()
  );

-- Only creator can update
CREATE POLICY "Creator can update folders"
  ON public.demand_folders FOR UPDATE
  USING (created_by = auth.uid());

-- Only creator or team owner can delete
CREATE POLICY "Creator or team owner can delete folders"
  ON public.demand_folders FOR DELETE
  USING (
    created_by = auth.uid()
    OR is_team_owner(auth.uid(), team_id)
  );

-- ==========================================
-- Update demand_folder_items RLS
-- ==========================================
DROP POLICY "Team members can view folder items" ON public.demand_folder_items;
DROP POLICY "Team members can add folder items" ON public.demand_folder_items;
DROP POLICY "Team members can remove folder items" ON public.demand_folder_items;

-- View: owner or shared can see items
CREATE POLICY "Folder members can view items"
  ON public.demand_folder_items FOR SELECT
  USING (has_folder_access(auth.uid(), folder_id));

-- Add: only owner can add items
CREATE POLICY "Folder owner can add items"
  ON public.demand_folder_items FOR INSERT
  WITH CHECK (is_folder_owner(auth.uid(), folder_id));

-- Remove: only owner can remove items
CREATE POLICY "Folder owner can remove items"
  ON public.demand_folder_items FOR DELETE
  USING (is_folder_owner(auth.uid(), folder_id));

-- ==========================================
-- demand_folder_shares RLS
-- ==========================================

-- Owner can view shares
CREATE POLICY "Folder owner can view shares"
  ON public.demand_folder_shares FOR SELECT
  USING (is_folder_owner(auth.uid(), folder_id));

-- Shared user can view own share
CREATE POLICY "Shared user can view own share"
  ON public.demand_folder_shares FOR SELECT
  USING (user_id = auth.uid());

-- Owner can add shares
CREATE POLICY "Folder owner can add shares"
  ON public.demand_folder_shares FOR INSERT
  WITH CHECK (is_folder_owner(auth.uid(), folder_id));

-- Owner can remove shares
CREATE POLICY "Folder owner can remove shares"
  ON public.demand_folder_shares FOR DELETE
  USING (is_folder_owner(auth.uid(), folder_id));

-- Shared user can remove themselves
CREATE POLICY "Shared user can leave folder"
  ON public.demand_folder_shares FOR DELETE
  USING (user_id = auth.uid());

-- Indexes
CREATE INDEX idx_demand_folder_shares_folder ON public.demand_folder_shares(folder_id);
CREATE INDEX idx_demand_folder_shares_user ON public.demand_folder_shares(user_id);
