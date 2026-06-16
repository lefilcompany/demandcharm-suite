-- Add 'executor' value to team_role enum
ALTER TYPE team_role ADD VALUE IF NOT EXISTS 'executor';

-- Create team_join_requests table
CREATE TABLE public.team_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES profiles(id),
  message TEXT,
  UNIQUE(team_id, user_id)
);

-- Enable RLS
ALTER TABLE public.team_join_requests ENABLE ROW LEVEL SECURITY;

-- Function to get team by access code (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_team_by_access_code(code TEXT)
RETURNS TABLE (id UUID, name TEXT, description TEXT, created_at TIMESTAMPTZ)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, description, created_at
  FROM teams
  WHERE access_code = code;
$$;

-- RLS Policies for team_join_requests

-- Users can create join requests (only for themselves)
CREATE POLICY "Users can create join requests"
ON public.team_join_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can view their own requests
CREATE POLICY "Users can view own requests"
ON public.team_join_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Team admins/moderators can view requests for their team
CREATE POLICY "Team admins can view team requests"
ON public.team_join_requests
FOR SELECT
USING (is_team_admin_or_moderator(auth.uid(), team_id));

-- Team admins can update request status
CREATE POLICY "Team admins can update requests"
ON public.team_join_requests
FOR UPDATE
USING (has_team_role(auth.uid(), team_id, 'admin'));