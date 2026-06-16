
-- Fix is_team_admin_or_moderator to use correct enum value 'admin' instead of 'owner'
CREATE OR REPLACE FUNCTION public.is_team_admin_or_moderator(_user_id uuid, _team_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id AND role = 'admin'
  )
$function$;

-- Fix is_team_admin to use correct enum value 'admin' instead of 'owner'
CREATE OR REPLACE FUNCTION public.is_team_admin(_user_id uuid, _team_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id AND role = 'admin'
  )
$function$;

-- Fix is_team_owner to use correct enum value directly instead of delegating
CREATE OR REPLACE FUNCTION public.is_team_owner(_user_id uuid, _team_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id AND team_id = _team_id AND role = 'admin'
  )
$function$;

-- Fix is_team_admin_or_moderator_for_board
CREATE OR REPLACE FUNCTION public.is_team_admin_or_moderator_for_board(_user_id uuid, _board_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.boards b ON b.team_id = tm.team_id
    WHERE tm.user_id = _user_id AND b.id = _board_id AND tm.role = 'admin'
  )
$function$;

-- Fix notify_team_join_request_created to use 'admin' instead of 'owner'
CREATE OR REPLACE FUNCTION public.notify_team_join_request_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
    WHERE team_id = NEW.team_id AND role = 'admin'
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

-- Fix notify_request_comment_created to use 'admin' instead of 'owner'
CREATE OR REPLACE FUNCTION public.notify_request_comment_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  request_record RECORD;
  commenter_name TEXT;
  commenter_role TEXT;
BEGIN
  SELECT * INTO request_record FROM public.demand_requests WHERE id = NEW.request_id;
  SELECT full_name INTO commenter_name FROM public.profiles WHERE id = NEW.user_id;
  SELECT role::text INTO commenter_role FROM public.team_members WHERE user_id = NEW.user_id AND team_id = request_record.team_id;
  
  IF commenter_role != 'admin' THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT 
      tm.user_id,
      'Novo comentário em solicitação',
      COALESCE(commenter_name, 'Um usuário') || ' comentou na solicitação "' || request_record.title || '"',
      'info',
      '/demand-requests'
    FROM public.team_members tm
    WHERE tm.team_id = request_record.team_id
    AND tm.role = 'admin'
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

-- Fix notify_demand_request_created to use 'admin' instead of 'owner'
CREATE OR REPLACE FUNCTION public.notify_demand_request_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
      WHERE team_id = NEW.team_id AND role = 'admin' AND user_id != NEW.created_by
    LOOP
      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES (admin_member.user_id, 'Nova solicitação de demanda',
        requester_name || ' solicitou a criação de uma demanda: "' || NEW.title || '"', 'info', '/demand-requests');
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix add_member_to_default_board to use 'admin' instead of 'owner'
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

-- Fix sync_admin_to_all_boards to use 'admin' instead of 'owner'
CREATE OR REPLACE FUNCTION public.sync_admin_to_all_boards()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.role = 'admin' AND (OLD.role IS NULL OR OLD.role != 'admin') THEN
    INSERT INTO public.board_members (board_id, user_id, role, added_by)
    SELECT b.id, NEW.user_id, 'admin'::team_role, NEW.user_id
    FROM public.boards b
    WHERE b.team_id = NEW.team_id
    ON CONFLICT (board_id, user_id) DO UPDATE SET role = 'admin'::team_role;
  END IF;
  RETURN NEW;
END;
$function$;
