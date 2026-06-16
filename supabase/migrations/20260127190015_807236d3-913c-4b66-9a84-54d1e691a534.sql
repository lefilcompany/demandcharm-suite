-- Fix the recursive RLS policy for notes shared with users
DROP POLICY IF EXISTS "Users can view notes shared with them" ON public.notes;

CREATE POLICY "Users can view notes shared with them"
ON public.notes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.note_shares ns
    WHERE ns.note_id = notes.id AND ns.shared_with_user_id = auth.uid()
  )
);