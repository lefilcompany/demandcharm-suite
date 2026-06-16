-- Create table for note share tokens
CREATE TABLE public.note_share_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Enable RLS
ALTER TABLE public.note_share_tokens ENABLE ROW LEVEL SECURITY;

-- Create function to check if note is shared
CREATE OR REPLACE FUNCTION public.is_note_shared(note_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM note_share_tokens nst 
    WHERE nst.note_id = note_id_param
    AND nst.is_active = true 
    AND (nst.expires_at IS NULL OR nst.expires_at > now())
  );
$$;

-- RLS policies for note_share_tokens
CREATE POLICY "Team members can view share tokens"
  ON public.note_share_tokens
  FOR SELECT
  USING (note_id IN (
    SELECT n.id FROM notes n WHERE is_team_member(auth.uid(), n.team_id)
  ));

CREATE POLICY "Team members can create share tokens"
  ON public.note_share_tokens
  FOR INSERT
  WITH CHECK (note_id IN (
    SELECT n.id FROM notes n WHERE is_team_member(auth.uid(), n.team_id)
  ) AND auth.uid() = created_by);

CREATE POLICY "Token creators can update their tokens"
  ON public.note_share_tokens
  FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Token creators can delete their tokens"
  ON public.note_share_tokens
  FOR DELETE
  USING (auth.uid() = created_by);

CREATE POLICY "Public can verify share tokens"
  ON public.note_share_tokens
  FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Update notes RLS to allow anonymous access for shared notes
CREATE POLICY "Anonymous can view shared notes"
  ON public.notes
  FOR SELECT
  USING (is_note_shared(id));

-- Allow anonymous to view profiles of note creators for shared notes
CREATE POLICY "Anonymous can view profiles for shared notes"
  ON public.profiles
  FOR SELECT
  USING (id IN (
    SELECT n.created_by FROM notes n WHERE is_note_shared(n.id)
  ));