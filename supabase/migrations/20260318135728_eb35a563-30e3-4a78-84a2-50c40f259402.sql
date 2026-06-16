-- 1. Delete all data associated with default boards
DELETE FROM public.demand_time_entries WHERE demand_id IN (
  SELECT d.id FROM public.demands d
  JOIN public.boards b ON b.id = d.board_id
  WHERE b.is_default = true
);

DELETE FROM public.demand_subtasks WHERE demand_id IN (
  SELECT d.id FROM public.demands d
  JOIN public.boards b ON b.id = d.board_id
  WHERE b.is_default = true
);

DELETE FROM public.demand_attachments WHERE demand_id IN (
  SELECT d.id FROM public.demands d
  JOIN public.boards b ON b.id = d.board_id
  WHERE b.is_default = true
);

DELETE FROM public.demand_interactions WHERE demand_id IN (
  SELECT d.id FROM public.demands d
  JOIN public.boards b ON b.id = d.board_id
  WHERE b.is_default = true
);

DELETE FROM public.demand_assignees WHERE demand_id IN (
  SELECT d.id FROM public.demands d
  JOIN public.boards b ON b.id = d.board_id
  WHERE b.is_default = true
);

DELETE FROM public.demand_share_tokens WHERE demand_id IN (
  SELECT d.id FROM public.demands d
  JOIN public.boards b ON b.id = d.board_id
  WHERE b.is_default = true
);

DELETE FROM public.demands WHERE board_id IN (
  SELECT id FROM public.boards WHERE is_default = true
);

DELETE FROM public.board_statuses WHERE board_id IN (
  SELECT id FROM public.boards WHERE is_default = true
);

DELETE FROM public.board_services WHERE board_id IN (
  SELECT id FROM public.boards WHERE is_default = true
);

DELETE FROM public.board_members WHERE board_id IN (
  SELECT id FROM public.boards WHERE is_default = true
);

DELETE FROM public.board_summary_share_tokens WHERE summary_id IN (
  SELECT bsh.id FROM public.board_summary_history bsh
  JOIN public.boards b ON b.id = bsh.board_id
  WHERE b.is_default = true
);
DELETE FROM public.board_summary_history WHERE board_id IN (
  SELECT id FROM public.boards WHERE is_default = true
);

DELETE FROM public.demand_statuses WHERE board_id IN (
  SELECT id FROM public.boards WHERE is_default = true
);

UPDATE public.demand_templates SET board_id = NULL WHERE board_id IN (
  SELECT id FROM public.boards WHERE is_default = true
);

UPDATE public.demand_requests SET board_id = NULL WHERE board_id IN (
  SELECT id FROM public.boards WHERE is_default = true
);

UPDATE public.services SET board_id = NULL WHERE board_id IN (
  SELECT id FROM public.boards WHERE is_default = true
);

-- 2. Delete all default boards
DELETE FROM public.boards WHERE is_default = true;

-- 3. Drop the create_default_board trigger
DROP TRIGGER IF EXISTS on_team_created ON public.teams;
DROP FUNCTION IF EXISTS public.create_default_board();

-- 4. Update add_member_to_default_board - no longer add to default board for non-admins
CREATE OR REPLACE FUNCTION public.add_member_to_default_board()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role = 'admin' THEN
    INSERT INTO public.board_members (board_id, user_id, role, added_by)
    SELECT b.id, NEW.user_id, 'admin'::team_role, NEW.user_id
    FROM public.boards b
    WHERE b.team_id = NEW.team_id
    ON CONFLICT (board_id, user_id) DO UPDATE SET role = 'admin'::team_role;
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Update board deletion RLS - remove is_default check
DROP POLICY IF EXISTS "Board admins can delete boards" ON public.boards;
CREATE POLICY "Board admins can delete boards"
ON public.boards
FOR DELETE
TO authenticated
USING (is_board_admin_or_moderator(auth.uid(), id));