
-- 1. Update add_member_to_default_board: admins go to default board only (like everyone else)
CREATE OR REPLACE FUNCTION public.add_member_to_default_board()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- All roles: add only to default board
  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  SELECT b.id, NEW.user_id, 
    CASE WHEN NEW.role = 'admin' THEN 'admin'::team_role ELSE 'requester'::team_role END,
    NEW.user_id
  FROM public.boards b
  WHERE b.team_id = NEW.team_id AND b.is_default = true
  ON CONFLICT (board_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- 2. Update sync_admin_to_all_boards: no longer auto-adds to all boards
CREATE OR REPLACE FUNCTION public.sync_admin_to_all_boards()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only update role on boards where the user is ALREADY a member
  IF NEW.role = 'admin' AND (OLD.role IS NULL OR OLD.role != 'admin') THEN
    UPDATE public.board_members
    SET role = 'admin'::team_role
    WHERE user_id = NEW.user_id
      AND board_id IN (SELECT id FROM public.boards WHERE team_id = NEW.team_id);
  END IF;
  
  -- If demoted from admin, revert board role to executor
  IF OLD.role = 'admin' AND NEW.role != 'admin' THEN
    UPDATE public.board_members
    SET role = 'executor'::team_role
    WHERE user_id = NEW.user_id
      AND board_id IN (SELECT id FROM public.boards WHERE team_id = NEW.team_id)
      AND role = 'admin'::team_role;
  END IF;
  
  RETURN NEW;
END;
$$;
