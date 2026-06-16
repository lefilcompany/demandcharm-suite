-- Create a table for shared team tags
CREATE TABLE public.note_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, name)
);

-- Enable RLS
ALTER TABLE public.note_tags ENABLE ROW LEVEL SECURITY;

-- Policies: team members can view and manage tags
CREATE POLICY "Team members can view tags"
  ON public.note_tags
  FOR SELECT
  USING (is_team_member(team_id, auth.uid()));

CREATE POLICY "Team members can create tags"
  ON public.note_tags
  FOR INSERT
  WITH CHECK (is_team_member(team_id, auth.uid()));

CREATE POLICY "Team admins can update tags"
  ON public.note_tags
  FOR UPDATE
  USING (is_team_admin_or_moderator(team_id, auth.uid()));

CREATE POLICY "Team admins can delete tags"
  ON public.note_tags
  FOR DELETE
  USING (is_team_admin_or_moderator(team_id, auth.uid()));