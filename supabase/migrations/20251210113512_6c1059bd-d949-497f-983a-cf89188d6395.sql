-- Create table for multiple assignees per demand
CREATE TABLE public.demand_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id uuid NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(demand_id, user_id)
);

-- Enable RLS
ALTER TABLE public.demand_assignees ENABLE ROW LEVEL SECURITY;

-- Team members can view assignees of demands in their teams
CREATE POLICY "Team members can view assignees"
ON public.demand_assignees FOR SELECT
USING (
  demand_id IN (
    SELECT id FROM public.demands 
    WHERE team_id IN (SELECT get_user_team_ids(auth.uid()))
  )
);

-- Team admins/moderators can add assignees
CREATE POLICY "Team admins/moderators can add assignees"
ON public.demand_assignees FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.demands d
    JOIN public.team_members tm ON tm.team_id = d.team_id
    WHERE d.id = demand_assignees.demand_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('admin', 'moderator')
  )
);

-- Team admins/moderators can remove assignees
CREATE POLICY "Team admins/moderators can remove assignees"
ON public.demand_assignees FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.demands d
    JOIN public.team_members tm ON tm.team_id = d.team_id
    WHERE d.id = demand_assignees.demand_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('admin', 'moderator')
  )
);

-- Add policy for team admins to delete teams
CREATE POLICY "Team admins can delete teams"
ON public.teams FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.team_members 
    WHERE team_id = teams.id 
    AND user_id = auth.uid() 
    AND role = 'admin'
  )
);