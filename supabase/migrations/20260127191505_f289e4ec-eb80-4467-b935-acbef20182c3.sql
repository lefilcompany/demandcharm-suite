-- Create enum for note share permission types
CREATE TYPE public.note_share_permission AS ENUM ('viewer', 'editor');

-- Add permission column to note_shares table
ALTER TABLE public.note_shares 
ADD COLUMN permission note_share_permission NOT NULL DEFAULT 'viewer';

-- Update RLS policy for notes to check permission for update
CREATE OR REPLACE FUNCTION public.can_edit_note(_note_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notes WHERE id = _note_id AND created_by = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.note_shares 
    WHERE note_id = _note_id 
    AND shared_with_user_id = _user_id 
    AND permission = 'editor'
  );
$$;

-- Drop old update policy if exists and create new one
DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
CREATE POLICY "Users can update notes they own or have editor access"
ON public.notes FOR UPDATE
USING (can_edit_note(id, auth.uid()))
WITH CHECK (can_edit_note(id, auth.uid()));