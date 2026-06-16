-- Create team_positions table for custom positions
CREATE TABLE public.team_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6B7280',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, name)
);

-- Add position_id column to team_members
ALTER TABLE public.team_members 
ADD COLUMN position_id UUID REFERENCES public.team_positions(id) ON DELETE SET NULL;

-- Enable RLS on team_positions
ALTER TABLE public.team_positions ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check team membership
CREATE OR REPLACE FUNCTION public.is_team_member(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
  )
$$;

-- Create security definer function to check if user is admin or moderator in team
CREATE OR REPLACE FUNCTION public.is_team_admin_or_moderator(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND role IN ('admin', 'moderator')
  )
$$;

-- Create security definer function to check if user is admin in team
CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND role = 'admin'
  )
$$;

-- RLS Policies for team_positions

-- Anyone in the team can view positions
CREATE POLICY "Team members can view positions"
ON public.team_positions
FOR SELECT
TO authenticated
USING (public.is_team_member(auth.uid(), team_id));

-- Admin and moderator can create positions
CREATE POLICY "Team admin and moderator can create positions"
ON public.team_positions
FOR INSERT
TO authenticated
WITH CHECK (public.is_team_admin_or_moderator(auth.uid(), team_id));

-- Admin and moderator can update positions
CREATE POLICY "Team admin and moderator can update positions"
ON public.team_positions
FOR UPDATE
TO authenticated
USING (public.is_team_admin_or_moderator(auth.uid(), team_id));

-- Only admin can delete positions
CREATE POLICY "Team admin can delete positions"
ON public.team_positions
FOR DELETE
TO authenticated
USING (public.is_team_admin(auth.uid(), team_id));

-- Add index for better performance
CREATE INDEX idx_team_positions_team_id ON public.team_positions(team_id);
CREATE INDEX idx_team_members_position_id ON public.team_members(position_id);