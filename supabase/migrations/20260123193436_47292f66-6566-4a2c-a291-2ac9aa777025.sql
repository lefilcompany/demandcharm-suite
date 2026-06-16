-- Add tags column to notes table
ALTER TABLE public.notes 
ADD COLUMN tags text[] DEFAULT '{}';

-- Create index for better tag search performance
CREATE INDEX idx_notes_tags ON public.notes USING GIN(tags);