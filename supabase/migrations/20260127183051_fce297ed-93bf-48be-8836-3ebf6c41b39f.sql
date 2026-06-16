-- Drop existing policies with wrong parameter order
DROP POLICY IF EXISTS "Team members can view tags" ON public.note_tags;
DROP POLICY IF EXISTS "Team members can create tags" ON public.note_tags;
DROP POLICY IF EXISTS "Team admins can update tags" ON public.note_tags;
DROP POLICY IF EXISTS "Team admins can delete tags" ON public.note_tags;

-- Recreate policies with correct parameter order
CREATE POLICY "Team members can view tags"
  ON public.note_tags
  FOR SELECT
  USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "Team members can create tags"
  ON public.note_tags
  FOR INSERT
  WITH CHECK (is_team_member(auth.uid(), team_id) AND auth.uid() = created_by);

CREATE POLICY "Team admins can update tags"
  ON public.note_tags
  FOR UPDATE
  USING (is_team_admin_or_moderator(auth.uid(), team_id));

CREATE POLICY "Team admins can delete tags"
  ON public.note_tags
  FOR DELETE
  USING (is_team_admin_or_moderator(auth.uid(), team_id));