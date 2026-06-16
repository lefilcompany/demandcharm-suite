-- Create a security definer function to check if user owns a note
CREATE OR REPLACE FUNCTION public.is_note_owner(_note_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notes
    WHERE id = _note_id AND created_by = _user_id
  )
$$;

-- Create a security definer function to check if note is shared with user
CREATE OR REPLACE FUNCTION public.is_note_shared_with_user(_note_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.note_shares
    WHERE note_id = _note_id AND shared_with_user_id = _user_id
  )
$$;

-- Fix note_shares policy to use security definer function
DROP POLICY IF EXISTS "Note owner can manage shares" ON public.note_shares;

CREATE POLICY "Note owner can manage shares"
ON public.note_shares FOR ALL
USING (is_note_owner(note_id, auth.uid()));

-- Fix notes policy to use security definer function  
DROP POLICY IF EXISTS "Users can view notes shared with them" ON public.notes;

CREATE POLICY "Users can view notes shared with them"
ON public.notes FOR SELECT
USING (is_note_shared_with_user(id, auth.uid()));