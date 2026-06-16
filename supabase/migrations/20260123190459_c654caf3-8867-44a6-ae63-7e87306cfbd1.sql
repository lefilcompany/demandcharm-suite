-- Create notes table
CREATE TABLE public.notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Sem título',
  content TEXT,
  icon TEXT DEFAULT '📝',
  cover_url TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  archived BOOLEAN NOT NULL DEFAULT false,
  parent_id UUID REFERENCES public.notes(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX idx_notes_team_id ON public.notes(team_id);
CREATE INDEX idx_notes_created_by ON public.notes(created_by);
CREATE INDEX idx_notes_parent_id ON public.notes(parent_id);

-- Enable RLS
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Team members can view notes" ON public.notes
  FOR SELECT USING (
    public.is_team_member(auth.uid(), team_id)
  );

CREATE POLICY "Team members can create notes" ON public.notes
  FOR INSERT WITH CHECK (
    public.is_team_member(auth.uid(), team_id) AND
    auth.uid() = created_by
  );

CREATE POLICY "Note creators can update their notes" ON public.notes
  FOR UPDATE USING (
    auth.uid() = created_by
  );

CREATE POLICY "Note creators can delete their notes" ON public.notes
  FOR DELETE USING (
    auth.uid() = created_by
  );

-- Trigger for updated_at
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notes;