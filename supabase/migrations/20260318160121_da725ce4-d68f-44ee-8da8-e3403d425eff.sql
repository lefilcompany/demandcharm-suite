
-- ============================================================
-- PRE-FIX: Dynamically drop ALL policies that depend on team_members.role
-- This fixes the "cannot alter type of a column used in a policy definition" error
-- ============================================================
DO $$
DECLARE
  pol RECORD;
BEGIN
  -- Find and drop ALL policies across all tables that reference team_members.role
  FOR pol IN
    SELECT policyname::text, tablename::text, schemaname::text
    FROM pg_policies
    WHERE (qual::text ILIKE '%team_members%' AND qual::text ILIKE '%role%')
       OR (with_check::text ILIKE '%team_members%' AND with_check::text ILIKE '%role%')
       OR policyname IN (
          'Team admins can delete teams',
          'Executors can view team requests',
          'Team admins, moderators and executors can create comments',
          'Team admins, moderators and executors can view request comments',
          'Team admins/moderators can remove assignees',
          'Team creators can add self as admin',
          'Team members can add assignees to their demands',
          'Team members can upload comment attachments',
          'Team members can view team payments',
          'Admins can delete contract files',
          'Admins can upload contract files'
        )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- Also explicitly drop known problematic policies (belt and suspenders)
DROP POLICY IF EXISTS "Team admins can delete teams" ON public.teams;
DROP POLICY IF EXISTS "Executors can view team requests" ON public.demand_requests;
DROP POLICY IF EXISTS "Team admins, moderators and executors can create comments" ON public.demand_request_comments;
DROP POLICY IF EXISTS "Team admins, moderators and executors can view request comments" ON public.demand_request_comments;
DROP POLICY IF EXISTS "Team admins/moderators can remove assignees" ON public.demand_assignees;
DROP POLICY IF EXISTS "Team creators can add self as admin" ON public.team_members;
DROP POLICY IF EXISTS "Team members can add assignees to their demands" ON public.demand_assignees;
DROP POLICY IF EXISTS "Team members can upload comment attachments" ON public.demand_request_attachments;
DROP POLICY IF EXISTS "Team members can view team payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can delete contract files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload contract files" ON storage.objects;

-- Drop trigger before column change
DROP TRIGGER IF EXISTS on_team_member_role_changed ON public.team_members;
DROP FUNCTION IF EXISTS public.handle_team_member_role_change() CASCADE;

-- ============================================================
-- Create new enum if not exists
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_membership_role') THEN
    CREATE TYPE public.team_membership_role AS ENUM ('owner', 'member');
  END IF;
END $$;

-- ============================================================
-- Handle column migration (idempotent)
-- ============================================================
DO $$
BEGIN
  -- Check if the role column still uses the old enum type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'team_members' 
      AND column_name = 'role'
      AND udt_name = 'team_role'
  ) THEN
    -- Add new column
    ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS membership_role public.team_membership_role NOT NULL DEFAULT 'member';
    
    -- Migrate data
    UPDATE public.team_members tm
    SET membership_role = CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.teams t WHERE t.id = tm.team_id AND t.created_by = tm.user_id
      ) THEN 'owner'::public.team_membership_role
      ELSE 'member'::public.team_membership_role
    END;
    
    -- Drop old column and rename
    ALTER TABLE public.team_members DROP COLUMN role;
    ALTER TABLE public.team_members RENAME COLUMN membership_role TO role;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'team_members' 
      AND column_name = 'membership_role'
  ) THEN
    -- Partial migration: old column already dropped, just rename
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'team_members' 
        AND column_name = 'role'
    ) THEN
      ALTER TABLE public.team_members RENAME COLUMN membership_role TO role;
    END IF;
  END IF;
END $$;

-- ============================================================
-- Drop old triggers/indexes
-- ============================================================
DROP TRIGGER IF EXISTS on_board_created_add_management_members ON public.boards;
DROP FUNCTION IF EXISTS public.add_management_members_to_board() CASCADE;
DROP INDEX IF EXISTS idx_boards_default_per_team;

-- ============================================================
-- Create/Update helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id AND role = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id AND role = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin_or_moderator(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id AND role = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.has_team_role(_user_id uuid, _team_id uuid, _role team_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id AND role = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_team_admin_or_moderator_for_board(_user_id uuid, _board_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.boards b ON b.team_id = tm.team_id
    WHERE tm.user_id = _user_id AND b.id = _board_id AND tm.role = 'owner'
  )
$$;

-- ============================================================
-- Re-create policies (idempotent with IF NOT EXISTS pattern)
-- ============================================================
DO $$
BEGIN
  -- Team owners can delete teams
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team owners can delete teams' AND tablename = 'teams') THEN
    CREATE POLICY "Team owners can delete teams" ON public.teams FOR DELETE TO public
    USING (is_team_owner(auth.uid(), id));
  END IF;

  -- Team members can add self
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team members can add self' AND tablename = 'team_members') THEN
    CREATE POLICY "Team members can add self" ON public.team_members FOR INSERT TO public
    WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Board members can remove assignees
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Board members can remove assignees' AND tablename = 'demand_assignees') THEN
    CREATE POLICY "Board members can remove assignees" ON public.demand_assignees FOR DELETE TO public
    USING (EXISTS (
      SELECT 1 FROM demands d JOIN board_members bm ON bm.board_id = d.board_id
      WHERE d.id = demand_assignees.demand_id AND bm.user_id = auth.uid() AND bm.role IN ('admin', 'moderator')
    ));
  END IF;

  -- Board members can add assignees
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Board members can add assignees' AND tablename = 'demand_assignees') THEN
    CREATE POLICY "Board members can add assignees" ON public.demand_assignees FOR INSERT TO public
    WITH CHECK (EXISTS (
      SELECT 1 FROM demands d JOIN board_members bm ON bm.board_id = d.board_id
      WHERE d.id = demand_assignees.demand_id AND bm.user_id = auth.uid()
        AND (bm.role IN ('admin', 'moderator') OR d.created_by = auth.uid())
    ));
  END IF;

  -- Comments policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team and board members can create comments' AND tablename = 'demand_request_comments') THEN
    CREATE POLICY "Team and board members can create comments" ON public.demand_request_comments FOR INSERT TO public
    WITH CHECK (auth.uid() = user_id AND EXISTS (
      SELECT 1 FROM demand_requests dr WHERE dr.id = demand_request_comments.request_id AND is_team_member(auth.uid(), dr.team_id)
    ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team and board members can view request comments' AND tablename = 'demand_request_comments') THEN
    CREATE POLICY "Team and board members can view request comments" ON public.demand_request_comments FOR SELECT TO public
    USING (EXISTS (
      SELECT 1 FROM demand_requests dr WHERE dr.id = demand_request_comments.request_id AND is_team_member(auth.uid(), dr.team_id)
    ));
  END IF;

  -- Attachments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Board members can upload comment attachments' AND tablename = 'demand_request_attachments') THEN
    CREATE POLICY "Board members can upload comment attachments" ON public.demand_request_attachments FOR INSERT TO public
    WITH CHECK (auth.uid() = uploaded_by AND comment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM demand_request_comments c JOIN demand_requests dr ON dr.id = c.request_id
      WHERE c.id = demand_request_attachments.comment_id AND is_team_member(auth.uid(), dr.team_id)
    ));
  END IF;

  -- Payments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team members can view team payments' AND tablename = 'payments') THEN
    CREATE POLICY "Team members can view team payments" ON public.payments FOR SELECT TO public
    USING (EXISTS (
      SELECT 1 FROM demand_requests dr WHERE dr.id = payments.demand_request_id AND is_team_member(auth.uid(), dr.team_id)
    ));
  END IF;

  -- Board executors view requests
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Board executors can view team requests' AND tablename = 'demand_requests') THEN
    CREATE POLICY "Board executors can view team requests" ON public.demand_requests FOR SELECT TO public
    USING (EXISTS (
      SELECT 1 FROM board_members bm JOIN boards b ON b.id = bm.board_id
      WHERE b.team_id = demand_requests.team_id AND bm.user_id = auth.uid()
    ));
  END IF;

  -- Boards policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team owners can create boards' AND tablename = 'boards') THEN
    DROP POLICY IF EXISTS "Team admins/moderators can create boards" ON public.boards;
    CREATE POLICY "Team owners can create boards" ON public.boards FOR INSERT TO authenticated
    WITH CHECK (is_team_owner(auth.uid(), team_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team owners can delete non-default boards' AND tablename = 'boards') THEN
    DROP POLICY IF EXISTS "Team admins can delete non-default boards" ON public.boards;
    CREATE POLICY "Team owners can delete non-default boards" ON public.boards FOR DELETE TO authenticated
    USING (is_team_owner(auth.uid(), team_id));
  END IF;

  -- Join requests policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team owners can update requests' AND tablename = 'team_join_requests') THEN
    DROP POLICY IF EXISTS "Team admins can update requests" ON public.team_join_requests;
    CREATE POLICY "Team owners can update requests" ON public.team_join_requests FOR UPDATE TO public
    USING (is_team_owner(auth.uid(), team_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team owners can view team requests' AND tablename = 'team_join_requests') THEN
    DROP POLICY IF EXISTS "Team admins can view team requests" ON public.team_join_requests;
    CREATE POLICY "Team owners can view team requests" ON public.team_join_requests FOR SELECT TO public
    USING (is_team_owner(auth.uid(), team_id));
  END IF;
END $$;

-- Storage policies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team owners can upload contract files' AND schemaname = 'storage') THEN
    CREATE POLICY "Team owners can upload contract files" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'contracts' AND EXISTS (
      SELECT 1 FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.role = 'owner'
    ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team owners can delete contract files' AND schemaname = 'storage') THEN
    CREATE POLICY "Team owners can delete contract files" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'contracts' AND EXISTS (
      SELECT 1 FROM team_members tm WHERE tm.user_id = auth.uid() AND tm.role = 'owner'
    ));
  END IF;
END $$;

-- ============================================================
-- FIX TRIGGER FUNCTIONS: Update to use 'owner' instead of 'admin'/'moderator'
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_team_join_request_created()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  admin_member RECORD;
  requester_name TEXT;
  team_name TEXT;
BEGIN
  SELECT full_name INTO requester_name FROM profiles WHERE id = NEW.user_id;
  SELECT name INTO team_name FROM teams WHERE id = NEW.team_id;
  
  FOR admin_member IN 
    SELECT user_id FROM team_members 
    WHERE team_id = NEW.team_id AND role = 'owner'
  LOOP
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      admin_member.user_id,
      'Nova solicitação de entrada',
      COALESCE(requester_name, 'Um usuário') || ' solicitou entrada na equipe "' || COALESCE(team_name, 'sua equipe') || '"',
      'info',
      '/teams/' || NEW.team_id || '/requests'
    );
  END LOOP;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_request_comment_created()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  request_record RECORD;
  commenter_name TEXT;
  commenter_role TEXT;
BEGIN
  SELECT * INTO request_record FROM public.demand_requests WHERE id = NEW.request_id;
  SELECT full_name INTO commenter_name FROM public.profiles WHERE id = NEW.user_id;
  SELECT role::text INTO commenter_role FROM public.team_members WHERE user_id = NEW.user_id AND team_id = request_record.team_id;
  
  IF commenter_role != 'owner' THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT 
      tm.user_id,
      'Novo comentário em solicitação',
      COALESCE(commenter_name, 'Um usuário') || ' comentou na solicitação "' || request_record.title || '"',
      'info',
      '/demand-requests'
    FROM public.team_members tm
    WHERE tm.team_id = request_record.team_id
    AND tm.role = 'owner'
    AND tm.user_id != NEW.user_id;
  END IF;
  
  IF request_record.created_by != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      request_record.created_by,
      'Novo comentário na sua solicitação',
      COALESCE(commenter_name, 'Um usuário') || ' comentou na sua solicitação "' || request_record.title || '"',
      'info',
      '/my-requests'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_admin_to_all_boards()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NEW.role = 'owner' AND (OLD.role IS NULL OR OLD.role != 'owner') THEN
    INSERT INTO public.board_members (board_id, user_id, role, added_by)
    SELECT b.id, NEW.user_id, 'admin'::team_role, NEW.user_id
    FROM public.boards b
    WHERE b.team_id = NEW.team_id
    ON CONFLICT (board_id, user_id) DO UPDATE SET role = 'admin'::team_role;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_member_to_default_board()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
BEGIN
  IF NEW.role = 'owner' THEN
    INSERT INTO public.board_members (board_id, user_id, role, added_by)
    SELECT b.id, NEW.user_id, 'admin'::team_role, NEW.user_id
    FROM public.boards b
    WHERE b.team_id = NEW.team_id
    ON CONFLICT (board_id, user_id) DO UPDATE SET role = 'admin'::team_role;
  END IF;
  RETURN NEW;
END;
$function$;

-- Also fix notify_demand_request_created to not reference old team_members roles
CREATE OR REPLACE FUNCTION public.notify_demand_request_created()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  admin_member RECORD;
  requester_name TEXT;
  team_name TEXT;
BEGIN
  SELECT full_name INTO requester_name FROM profiles WHERE id = NEW.created_by;
  SELECT name INTO team_name FROM teams WHERE id = NEW.team_id;
  
  IF NEW.board_id IS NOT NULL THEN
    FOR admin_member IN 
      SELECT user_id FROM board_members 
      WHERE board_id = NEW.board_id AND role IN ('admin', 'moderator') AND user_id != NEW.created_by
    LOOP
      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES (admin_member.user_id, 'Nova solicitação de demanda',
        requester_name || ' solicitou a criação de uma demanda: "' || NEW.title || '"', 'info', '/demand-requests');
    END LOOP;
  ELSE
    FOR admin_member IN 
      SELECT user_id FROM team_members 
      WHERE team_id = NEW.team_id AND role = 'owner' AND user_id != NEW.created_by
    LOOP
      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES (admin_member.user_id, 'Nova solicitação de demanda',
        requester_name || ' solicitou a criação de uma demanda: "' || NEW.title || '"', 'info', '/demand-requests');
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- ============================================================
-- Update create_board_with_services RPC (idempotent)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_board_with_services(
  p_team_id UUID, p_name TEXT, p_description TEXT DEFAULT NULL, p_services JSONB DEFAULT '[]'::JSONB
)
RETURNS public.boards
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_new_board public.boards;
  v_service JSONB;
  v_service_id UUID;
  v_monthly_limit INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated' USING ERRCODE = 'PGRST301'; END IF;
  IF NOT public.is_team_owner(v_user_id, p_team_id) THEN RAISE EXCEPTION 'Permission denied: must be team owner' USING ERRCODE = '42501'; END IF;
  IF p_name IS NULL OR trim(p_name) = '' THEN RAISE EXCEPTION 'Board name is required' USING ERRCODE = '22000'; END IF;
  IF length(trim(p_name)) > 100 THEN RAISE EXCEPTION 'Board name too long (max 100 characters)' USING ERRCODE = '22000'; END IF;
  IF EXISTS (SELECT 1 FROM public.boards WHERE team_id = p_team_id AND lower(trim(name)) = lower(trim(p_name))) THEN
    RAISE EXCEPTION 'A board with this name already exists' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.boards (team_id, name, description, created_by, is_default, monthly_demand_limit)
  VALUES (p_team_id, trim(p_name), nullif(trim(p_description), ''), v_user_id, false, 0)
  RETURNING * INTO v_new_board;

  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  VALUES (v_new_board.id, v_user_id, 'admin', v_user_id)
  ON CONFLICT (board_id, user_id) DO NOTHING;

  IF p_services IS NOT NULL AND jsonb_array_length(p_services) > 0 THEN
    FOR v_service IN SELECT * FROM jsonb_array_elements(p_services) LOOP
      v_service_id := (v_service->>'service_id')::UUID;
      v_monthly_limit := COALESCE((v_service->>'monthly_limit')::INTEGER, 0);
      IF EXISTS (SELECT 1 FROM public.services WHERE id = v_service_id AND team_id = p_team_id) THEN
        INSERT INTO public.board_services (board_id, service_id, monthly_limit)
        VALUES (v_new_board.id, v_service_id, v_monthly_limit) ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.demand_statuses (name, color, board_id, is_system) VALUES
    ('A Fazer', '#6B7280', v_new_board.id, true),
    ('Em Andamento', '#3B82F6', v_new_board.id, true),
    ('Em Revisão', '#F59E0B', v_new_board.id, true),
    ('Entregue', '#10B981', v_new_board.id, true);

  INSERT INTO public.board_statuses (board_id, status_id, position, is_active)
  SELECT v_new_board.id, ds.id, ROW_NUMBER() OVER (ORDER BY ds.created_at) - 1, true
  FROM public.demand_statuses ds WHERE ds.board_id = v_new_board.id;

  RETURN v_new_board;
END;
$$;
