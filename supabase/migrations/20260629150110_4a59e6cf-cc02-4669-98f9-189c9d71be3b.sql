
-- Preserve existing board roles when team member is inserted as admin
CREATE OR REPLACE FUNCTION public.add_member_to_default_board()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role = 'admin' THEN
    INSERT INTO public.board_members (board_id, user_id, role, added_by)
    SELECT b.id, NEW.user_id, 'moderator'::team_role, NEW.user_id
    FROM public.boards b WHERE b.team_id = NEW.team_id
    ON CONFLICT (board_id, user_id) DO NOTHING;
  ELSE
    INSERT INTO public.board_members (board_id, user_id, role, added_by)
    SELECT b.id, NEW.user_id, 'requester'::team_role, NEW.user_id
    FROM public.boards b WHERE b.team_id = NEW.team_id AND b.is_default = true
    ON CONFLICT (board_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- New trigger: when a member is promoted to admin (owner), grant moderator on boards they aren't part of
CREATE OR REPLACE FUNCTION public.on_team_member_promoted_to_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role = 'admin' AND OLD.role IS DISTINCT FROM 'admin' THEN
    INSERT INTO public.board_members (board_id, user_id, role, added_by)
    SELECT b.id, NEW.user_id, 'moderator'::team_role, NEW.user_id
    FROM public.boards b
    WHERE b.team_id = NEW.team_id
    ON CONFLICT (board_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_team_member_promoted_to_admin ON public.team_members;
CREATE TRIGGER on_team_member_promoted_to_admin
AFTER UPDATE OF role ON public.team_members
FOR EACH ROW
EXECUTE FUNCTION public.on_team_member_promoted_to_admin();

-- Backfill: for every current team admin/owner, ensure they are members of all their team's boards as moderator (without overwriting existing role)
INSERT INTO public.board_members (board_id, user_id, role, added_by)
SELECT b.id, tm.user_id, 'moderator'::team_role, tm.user_id
FROM public.team_members tm
JOIN public.boards b ON b.team_id = tm.team_id
WHERE tm.role = 'admin'
ON CONFLICT (board_id, user_id) DO NOTHING;
