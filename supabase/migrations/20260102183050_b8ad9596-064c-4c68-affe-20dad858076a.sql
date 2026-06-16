-- Create table for per-user time tracking on demands
CREATE TABLE public.demand_time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_demand_time_entries_demand_id ON public.demand_time_entries(demand_id);
CREATE INDEX idx_demand_time_entries_user_id ON public.demand_time_entries(user_id);
CREATE INDEX idx_demand_time_entries_active ON public.demand_time_entries(demand_id, user_id) WHERE ended_at IS NULL;

-- Enable RLS
ALTER TABLE public.demand_time_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Team members can view time entries"
ON public.demand_time_entries
FOR SELECT
USING (
  demand_id IN (
    SELECT d.id FROM demands d
    WHERE d.team_id IN (SELECT get_user_team_ids(auth.uid()))
  )
);

CREATE POLICY "Users can create their own time entries"
ON public.demand_time_entries
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  demand_id IN (
    SELECT d.id FROM demands d
    WHERE d.team_id IN (SELECT get_user_team_ids(auth.uid()))
  )
);

CREATE POLICY "Users can update their own time entries"
ON public.demand_time_entries
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own time entries"
ON public.demand_time_entries
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.demand_time_entries;