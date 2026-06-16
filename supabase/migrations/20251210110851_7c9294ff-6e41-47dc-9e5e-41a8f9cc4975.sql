-- Create team role enum
CREATE TYPE public.team_role AS ENUM ('admin', 'moderator', 'requester');

-- Add role column to team_members
ALTER TABLE public.team_members 
ADD COLUMN role team_role NOT NULL DEFAULT 'requester';

-- Update creator to be admin when they create a team
-- First, update existing team creators to be admins
UPDATE public.team_members tm
SET role = 'admin'
FROM public.teams t
WHERE tm.team_id = t.id AND tm.user_id = t.created_by;

-- Create function to check team role
CREATE OR REPLACE FUNCTION public.has_team_role(_user_id uuid, _team_id uuid, _role team_role)
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
      AND role = _role
  )
$$;

-- Create function to check if user is team admin or moderator
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

-- Create services table (admin/moderator can create services with estimated deadlines)
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  estimated_days integer NOT NULL DEFAULT 7,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on services
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- RLS policies for services
CREATE POLICY "Team members can view services"
ON public.services FOR SELECT
USING (team_id IN (SELECT get_user_team_ids(auth.uid())));

CREATE POLICY "Team admins and moderators can create services"
ON public.services FOR INSERT
WITH CHECK (is_team_admin_or_moderator(auth.uid(), team_id));

CREATE POLICY "Team admins and moderators can update services"
ON public.services FOR UPDATE
USING (is_team_admin_or_moderator(auth.uid(), team_id));

CREATE POLICY "Team admins can delete services"
ON public.services FOR DELETE
USING (has_team_role(auth.uid(), team_id, 'admin'));

-- Add service_id to demands
ALTER TABLE public.demands
ADD COLUMN service_id uuid REFERENCES public.services(id);

-- Update team_members policies for role management
CREATE POLICY "Team admins can update member roles"
ON public.team_members FOR UPDATE
USING (
  team_id IN (
    SELECT team_id FROM public.team_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Policy for team admins to delete members
CREATE POLICY "Team admins can remove members"
ON public.team_members FOR DELETE
USING (
  team_id IN (
    SELECT team_id FROM public.team_members 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Add trigger for services updated_at
CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON public.services
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Add index for team_members role lookups
CREATE INDEX idx_team_members_role ON public.team_members(team_id, role);