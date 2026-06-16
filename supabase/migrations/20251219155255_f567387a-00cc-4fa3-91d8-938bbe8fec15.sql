-- Fix the notification function to use correct link
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
  -- Get requester name and team name
  SELECT full_name INTO requester_name FROM profiles WHERE id = NEW.user_id;
  SELECT name INTO team_name FROM teams WHERE id = NEW.team_id;
  
  -- Notify all admins and moderators of the team
  FOR admin_member IN 
    SELECT user_id FROM team_members 
    WHERE team_id = NEW.team_id 
    AND role IN ('admin', 'moderator')
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

-- Fix existing notification with wrong link
UPDATE notifications 
SET link = '/teams/' || SUBSTRING(link FROM '/team-requests/(.+)')::uuid || '/requests'
WHERE link LIKE '/team-requests/%';