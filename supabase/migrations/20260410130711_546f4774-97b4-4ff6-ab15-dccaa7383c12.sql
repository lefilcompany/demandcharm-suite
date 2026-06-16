
-- Create demand_folders table
CREATE TABLE public.demand_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6B7280',
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create demand_folder_items table
CREATE TABLE public.demand_folder_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  folder_id UUID NOT NULL REFERENCES public.demand_folders(id) ON DELETE CASCADE,
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(folder_id, demand_id)
);

-- Enable RLS
ALTER TABLE public.demand_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_folder_items ENABLE ROW LEVEL SECURITY;

-- RLS for demand_folders
CREATE POLICY "Team members can view folders"
  ON public.demand_folders FOR SELECT
  USING (public.is_team_member(auth.uid(), team_id));

CREATE POLICY "Team members can create folders"
  ON public.demand_folders FOR INSERT
  WITH CHECK (public.is_team_member(auth.uid(), team_id) AND created_by = auth.uid());

CREATE POLICY "Team members can update folders"
  ON public.demand_folders FOR UPDATE
  USING (public.is_team_member(auth.uid(), team_id));

CREATE POLICY "Creator or team owner can delete folders"
  ON public.demand_folders FOR DELETE
  USING (created_by = auth.uid() OR public.is_team_owner(auth.uid(), team_id));

-- RLS for demand_folder_items
CREATE POLICY "Team members can view folder items"
  ON public.demand_folder_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.demand_folders df
    WHERE df.id = folder_id AND public.is_team_member(auth.uid(), df.team_id)
  ));

CREATE POLICY "Team members can add folder items"
  ON public.demand_folder_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.demand_folders df
    WHERE df.id = folder_id AND public.is_team_member(auth.uid(), df.team_id)
  ));

CREATE POLICY "Team members can remove folder items"
  ON public.demand_folder_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.demand_folders df
    WHERE df.id = folder_id AND public.is_team_member(auth.uid(), df.team_id)
  ));

-- Trigger for updated_at
CREATE TRIGGER update_demand_folders_updated_at
  BEFORE UPDATE ON public.demand_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Indexes
CREATE INDEX idx_demand_folders_team_id ON public.demand_folders(team_id);
CREATE INDEX idx_demand_folder_items_folder_id ON public.demand_folder_items(folder_id);
CREATE INDEX idx_demand_folder_items_demand_id ON public.demand_folder_items(demand_id);
