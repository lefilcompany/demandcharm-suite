-- Create table for internal note sharing with team members
CREATE TABLE public.note_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_id UUID NOT NULL REFERENCES public.notes(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(note_id, shared_with_user_id)
);

-- Enable RLS
ALTER TABLE public.note_shares ENABLE ROW LEVEL SECURITY;

-- Policy: Note owner can manage shares
CREATE POLICY "Note owner can manage shares"
ON public.note_shares
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.notes n
    WHERE n.id = note_id AND n.created_by = auth.uid()
  )
);

-- Policy: Shared users can view their shares
CREATE POLICY "Users can view shares they received"
ON public.note_shares
FOR SELECT
USING (shared_with_user_id = auth.uid());

-- Update notes RLS to allow shared users to view
CREATE POLICY "Users can view notes shared with them"
ON public.notes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.note_shares ns
    WHERE ns.note_id = id AND ns.shared_with_user_id = auth.uid()
  )
);

-- Enable realtime for note_shares
ALTER PUBLICATION supabase_realtime ADD TABLE public.note_shares;