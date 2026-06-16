
-- Drop ALL policies that depend on team_members.role (both old and new names)
DROP POLICY IF EXISTS "Team admins can delete teams" ON public.teams;
DROP POLICY IF EXISTS "Team owners can delete teams" ON public.teams;
DROP POLICY IF EXISTS "Team admins/moderators can remove assignees" ON public.demand_assignees;
DROP POLICY IF EXISTS "Team members can add assignees to their demands" ON public.demand_assignees;
DROP POLICY IF EXISTS "Board members can add assignees" ON public.demand_assignees;
DROP POLICY IF EXISTS "Board members can remove assignees" ON public.demand_assignees;
DROP POLICY IF EXISTS "Executors can view team requests" ON public.demand_requests;
DROP POLICY IF EXISTS "Board executors can view team requests" ON public.demand_requests;
DROP POLICY IF EXISTS "Team admins, moderators and executors can create comments" ON public.demand_request_comments;
DROP POLICY IF EXISTS "Team admins, moderators and executors can view request comments" ON public.demand_request_comments;
DROP POLICY IF EXISTS "Team members can create comments" ON public.demand_request_comments;
DROP POLICY IF EXISTS "Team members can view request comments" ON public.demand_request_comments;
DROP POLICY IF EXISTS "Team members can upload comment attachments" ON public.demand_request_attachments;
DROP POLICY IF EXISTS "Board members can upload comment attachments" ON public.demand_request_attachments;
DROP POLICY IF EXISTS "Team members can view team payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can delete contract files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload contract files" ON storage.objects;
DROP POLICY IF EXISTS "Team creators can add self as admin" ON public.team_members;
DROP POLICY IF EXISTS "Team creators can add self as owner" ON public.team_members;
DROP POLICY IF EXISTS "Team owners can add members" ON public.team_members;
DROP POLICY IF EXISTS "Team owners can remove members" ON public.team_members;
DROP POLICY IF EXISTS "Team owners can update members" ON public.team_members;
DROP POLICY IF EXISTS "Users can join teams with access code" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can add members" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can remove members" ON public.team_members;
DROP POLICY IF EXISTS "Team admins can update member roles" ON public.team_members;

-- Drop old triggers
DROP TRIGGER IF EXISTS on_team_member_role_changed ON public.team_members;
DROP FUNCTION IF EXISTS public.handle_team_member_role_change() CASCADE;
DROP TRIGGER IF EXISTS on_board_created_add_management_members ON public.boards;
DROP FUNCTION IF EXISTS public.add_management_members_to_board() CASCADE;

-- Change column type if needed
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'team_members' 
    AND column_name = 'role' AND udt_name = 'team_role'
  ) THEN
    ALTER TABLE public.team_members ALTER COLUMN role TYPE public.team_membership_role 
    USING CASE role::text
      WHEN 'admin' THEN 'owner'::public.team_membership_role
      WHEN 'moderator' THEN 'owner'::public.team_membership_role
      ELSE 'member'::public.team_membership_role
    END;
    ALTER TABLE public.team_members ALTER COLUMN role SET DEFAULT 'member'::public.team_membership_role;
  END IF;
END $$;

-- Recreate policies
CREATE POLICY "Team owners can delete teams" ON public.teams
FOR DELETE TO authenticated USING (public.is_team_owner(auth.uid(), id));

CREATE POLICY "Team creators can add self as owner" ON public.team_members
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'owner'::public.team_membership_role AND public.is_team_creator(auth.uid(), team_id));

CREATE POLICY "Team owners can add members" ON public.team_members
FOR INSERT TO authenticated
WITH CHECK (public.is_team_owner(auth.uid(), team_id) AND role = 'member'::public.team_membership_role);

CREATE POLICY "Team owners can remove members" ON public.team_members
FOR DELETE TO authenticated USING (public.is_team_owner(auth.uid(), team_id));

CREATE POLICY "Team owners can update members" ON public.team_members
FOR UPDATE TO authenticated
USING (public.is_team_owner(auth.uid(), team_id))
WITH CHECK (public.is_team_owner(auth.uid(), team_id));

CREATE POLICY "Board members can add assignees" ON public.demand_assignees
FOR INSERT TO public
WITH CHECK (EXISTS (
  SELECT 1 FROM demands d JOIN board_members bm ON bm.board_id = d.board_id
  WHERE d.id = demand_assignees.demand_id AND bm.user_id = auth.uid()
  AND (bm.role IN ('admin', 'moderator') OR d.created_by = auth.uid())
));

CREATE POLICY "Board members can remove assignees" ON public.demand_assignees
FOR DELETE TO public
USING (EXISTS (
  SELECT 1 FROM demands d JOIN board_members bm ON bm.board_id = d.board_id
  WHERE d.id = demand_assignees.demand_id AND bm.user_id = auth.uid()
  AND bm.role IN ('admin', 'moderator')
));

CREATE POLICY "Board executors can view team requests" ON public.demand_requests
FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM board_members bm JOIN boards b ON b.id = bm.board_id
  WHERE b.team_id = demand_requests.team_id AND bm.user_id = auth.uid()
));

CREATE POLICY "Team members can create comments" ON public.demand_request_comments
FOR INSERT TO public
WITH CHECK (auth.uid() = user_id AND EXISTS (
  SELECT 1 FROM demand_requests dr WHERE dr.id = demand_request_comments.request_id
  AND (dr.created_by = auth.uid() OR public.is_team_admin_or_moderator(auth.uid(), dr.team_id)
    OR EXISTS (SELECT 1 FROM board_members bm JOIN boards b ON b.id = bm.board_id WHERE b.team_id = dr.team_id AND bm.user_id = auth.uid()))
));

CREATE POLICY "Team members can view request comments" ON public.demand_request_comments
FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM demand_requests dr WHERE dr.id = demand_request_comments.request_id
  AND (dr.created_by = auth.uid() OR public.is_team_admin_or_moderator(auth.uid(), dr.team_id)
    OR EXISTS (SELECT 1 FROM board_members bm JOIN boards b ON b.id = bm.board_id WHERE b.team_id = dr.team_id AND bm.user_id = auth.uid()))
));

CREATE POLICY "Board members can upload comment attachments" ON public.demand_request_attachments
FOR INSERT TO public
WITH CHECK (auth.uid() = uploaded_by AND comment_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM demand_request_comments c JOIN demand_requests dr ON dr.id = c.request_id
  WHERE c.id = demand_request_attachments.comment_id AND public.is_team_member(auth.uid(), dr.team_id)
));

CREATE POLICY "Team members can view team payments" ON public.payments
FOR SELECT TO public
USING (EXISTS (
  SELECT 1 FROM demand_requests dr
  WHERE dr.id = payments.demand_request_id AND public.is_team_member(auth.uid(), dr.team_id)
));
