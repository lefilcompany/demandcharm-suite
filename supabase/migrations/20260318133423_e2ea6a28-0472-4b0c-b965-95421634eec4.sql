
-- ============================================================
-- PHASE 1: Create new enum and add new column
-- ============================================================
CREATE TYPE public.team_membership_role AS ENUM ('owner', 'member');

ALTER TABLE public.team_members ADD COLUMN membership_role public.team_membership_role NOT NULL DEFAULT 'member';

-- Migrate data: team creators become owner, rest become member
UPDATE public.team_members tm
SET membership_role = CASE 
  WHEN EXISTS (
    SELECT 1 FROM public.teams t WHERE t.id = tm.team_id AND t.created_by = tm.user_id
  ) THEN 'owner'::public.team_membership_role
  ELSE 'member'::public.team_membership_role
END;

-- ============================================================
-- PHASE 2: Drop ALL dependent objects on team_members.role
-- ============================================================

-- Drop trigger
DROP TRIGGER IF EXISTS on_team_member_role_changed ON public.team_members;
DROP FUNCTION IF EXISTS public.handle_team_member_role_change() CASCADE;

-- Drop RLS policies that reference team_members.role directly
DROP POLICY IF EXISTS "Executors can view team requests" ON public.demand_requests;
DROP POLICY IF EXISTS "Team admins can delete teams" ON public.teams;
DROP POLICY IF EXISTS "Team admins, moderators and executors can create comments" ON public.demand_request_comments;
DROP POLICY IF EXISTS "Team admins, moderators and executors can view request comments" ON public.demand_request_comments;
DROP POLICY IF EXISTS "Team admins/moderators can remove assignees" ON public.demand_assignees;
DROP POLICY IF EXISTS "Team creators can add self as admin" ON public.team_members;
DROP POLICY IF EXISTS "Team members can add assignees to their demands" ON public.demand_assignees;
DROP POLICY IF EXISTS "Team members can upload comment attachments" ON public.demand_request_attachments;
DROP POLICY IF EXISTS "Team members can view team payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can delete contract files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload contract files" ON storage.objects;

-- ============================================================
-- PHASE 3: Drop old column and rename new one
-- ============================================================
ALTER TABLE public.team_members DROP COLUMN role;
ALTER TABLE public.team_members RENAME COLUMN membership_role TO role;

-- ============================================================
-- PHASE 4: Remove triggers and constraints for old model
-- ============================================================
DROP TRIGGER IF EXISTS on_board_created_add_management_members ON public.boards;
DROP FUNCTION IF EXISTS public.add_management_members_to_board() CASCADE;
DROP INDEX IF EXISTS idx_boards_default_per_team;

-- ============================================================
-- PHASE 5: Create/Update helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND role = 'owner'
  )
$$;

-- Update existing functions to use new role column
CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND role = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin_or_moderator(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND role = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_team_role(_user_id uuid, _team_id uuid, _role team_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- This function is kept for backward compatibility with existing RLS policies
  -- that pass team_role enum. Now it just checks if user is team owner.
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND role = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin_or_moderator_for_board(_user_id uuid, _board_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.boards b ON b.team_id = tm.team_id
    WHERE tm.user_id = _user_id
      AND b.id = _board_id
      AND tm.role = 'owner'
  )
$$;

-- ============================================================
-- PHASE 6: Re-create dropped policies with new logic
-- ============================================================

-- Team owners can delete teams
CREATE POLICY "Team owners can delete teams"
ON public.teams
FOR DELETE
TO public
USING (is_team_owner(auth.uid(), id));

-- Team members can add self (owner role for creators)
CREATE POLICY "Team members can add self"
ON public.team_members
FOR INSERT
TO public
WITH CHECK (auth.uid() = user_id);

-- Board members can manage assignees (moved to board-level)
CREATE POLICY "Board members can remove assignees"
ON public.demand_assignees
FOR DELETE
TO public
USING (EXISTS (
  SELECT 1 FROM demands d
  JOIN board_members bm ON bm.board_id = d.board_id
  WHERE d.id = demand_assignees.demand_id
    AND bm.user_id = auth.uid()
    AND bm.role IN ('admin', 'moderator')
));

CREATE POLICY "Board members can add assignees"
ON public.demand_assignees
FOR INSERT
TO public
WITH CHECK (EXISTS (
  SELECT 1 FROM demands d
  JOIN board_members bm ON bm.board_id = d.board_id
  WHERE d.id = demand_assignees.demand_id
    AND bm.user_id = auth.uid()
    AND (bm.role IN ('admin', 'moderator') OR d.created_by = auth.uid())
));

-- demand_request_comments - board members can create/view
CREATE POLICY "Team and board members can create comments"
ON public.demand_request_comments
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM demand_requests dr
    WHERE dr.id = demand_request_comments.request_id
      AND is_team_member(auth.uid(), dr.team_id)
  )
);

CREATE POLICY "Team and board members can view request comments"
ON public.demand_request_comments
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM demand_requests dr
    WHERE dr.id = demand_request_comments.request_id
      AND is_team_member(auth.uid(), dr.team_id)
  )
);

-- demand_request_attachments - board-level upload
CREATE POLICY "Board members can upload comment attachments"
ON public.demand_request_attachments
FOR INSERT
TO public
WITH CHECK (
  auth.uid() = uploaded_by AND
  comment_id IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM demand_request_comments c
    JOIN demand_requests dr ON dr.id = c.request_id
    WHERE c.id = demand_request_attachments.comment_id
      AND is_team_member(auth.uid(), dr.team_id)
  )
);

-- Payments - team members can view
CREATE POLICY "Team members can view team payments"
ON public.payments
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM demand_requests dr
    WHERE dr.id = payments.demand_request_id
      AND is_team_member(auth.uid(), dr.team_id)
  )
);

-- Executors (board-level) can view demand requests
CREATE POLICY "Board executors can view team requests"
ON public.demand_requests
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM board_members bm
    JOIN boards b ON b.id = bm.board_id
    WHERE b.team_id = demand_requests.team_id
      AND bm.user_id = auth.uid()
  )
);

-- Storage policies for contracts
CREATE POLICY "Team owners can upload contract files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'contracts' AND
  EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.role = 'owner'
  )
);

CREATE POLICY "Team owners can delete contract files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'contracts' AND
  EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.role = 'owner'
  )
);

-- ============================================================
-- PHASE 7: Update boards policies
-- ============================================================
DROP POLICY IF EXISTS "Team admins/moderators can create boards" ON public.boards;
CREATE POLICY "Team owners can create boards"
ON public.boards
FOR INSERT
TO authenticated
WITH CHECK (is_team_owner(auth.uid(), team_id));

DROP POLICY IF EXISTS "Team admins can delete non-default boards" ON public.boards;
CREATE POLICY "Team owners can delete non-default boards"
ON public.boards
FOR DELETE
TO authenticated
USING (is_team_owner(auth.uid(), team_id));

-- ============================================================
-- PHASE 8: Update team_join_requests policies  
-- ============================================================
DROP POLICY IF EXISTS "Team admins can update requests" ON public.team_join_requests;
CREATE POLICY "Team owners can update requests"
ON public.team_join_requests
FOR UPDATE
TO public
USING (is_team_owner(auth.uid(), team_id));

DROP POLICY IF EXISTS "Team admins can view team requests" ON public.team_join_requests;
CREATE POLICY "Team owners can view team requests"
ON public.team_join_requests
FOR SELECT
TO public
USING (is_team_owner(auth.uid(), team_id));

-- ============================================================
-- PHASE 9: Update create_board_with_services RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_board_with_services(
  p_team_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_services JSONB DEFAULT '[]'::JSONB
)
RETURNS public.boards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_new_board public.boards;
  v_service JSONB;
  v_service_id UUID;
  v_monthly_limit INTEGER;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'PGRST301';
  END IF;

  IF NOT public.is_team_owner(v_user_id, p_team_id) THEN
    RAISE EXCEPTION 'Permission denied: must be team owner' USING ERRCODE = '42501';
  END IF;

  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Board name is required' USING ERRCODE = '22000';
  END IF;

  IF length(trim(p_name)) > 100 THEN
    RAISE EXCEPTION 'Board name too long (max 100 characters)' USING ERRCODE = '22000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.boards
    WHERE team_id = p_team_id
    AND lower(trim(name)) = lower(trim(p_name))
  ) THEN
    RAISE EXCEPTION 'A board with this name already exists' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.boards (team_id, name, description, created_by, is_default, monthly_demand_limit)
  VALUES (p_team_id, trim(p_name), nullif(trim(p_description), ''), v_user_id, false, 0)
  RETURNING * INTO v_new_board;

  -- Only add creator as board admin
  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  VALUES (v_new_board.id, v_user_id, 'admin', v_user_id)
  ON CONFLICT (board_id, user_id) DO NOTHING;

  IF p_services IS NOT NULL AND jsonb_array_length(p_services) > 0 THEN
    FOR v_service IN SELECT * FROM jsonb_array_elements(p_services)
    LOOP
      v_service_id := (v_service->>'service_id')::UUID;
      v_monthly_limit := COALESCE((v_service->>'monthly_limit')::INTEGER, 0);

      IF EXISTS (SELECT 1 FROM public.services WHERE id = v_service_id AND team_id = p_team_id) THEN
        INSERT INTO public.board_services (board_id, service_id, monthly_limit)
        VALUES (v_new_board.id, v_service_id, v_monthly_limit)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.demand_statuses (name, color, board_id, is_system)
  VALUES
    ('A Fazer', '#6B7280', v_new_board.id, true),
    ('Em Andamento', '#3B82F6', v_new_board.id, true),
    ('Em Revisão', '#F59E0B', v_new_board.id, true),
    ('Entregue', '#10B981', v_new_board.id, true);

  INSERT INTO public.board_statuses (board_id, status_id, position, is_active)
  SELECT v_new_board.id, ds.id, 
    ROW_NUMBER() OVER (ORDER BY ds.created_at) - 1,
    true
  FROM public.demand_statuses ds
  WHERE ds.board_id = v_new_board.id;

  RETURN v_new_board;
END;
$$;
