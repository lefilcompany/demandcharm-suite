-- Function to notify admins/moderators when a join request is created
CREATE OR REPLACE FUNCTION public.notify_team_join_request_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      '/team-requests/' || NEW.team_id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger to fire on new join request
CREATE TRIGGER on_team_join_request_created
  AFTER INSERT ON team_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_team_join_request_created();

-- Function to notify user when their request is approved/rejected
CREATE OR REPLACE FUNCTION public.notify_team_join_request_responded()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  team_name TEXT;
BEGIN
  -- Only trigger if status changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get team name
  SELECT name INTO team_name FROM teams WHERE id = NEW.team_id;
  
  IF NEW.status = 'approved' THEN
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      NEW.user_id,
      'Solicitação aprovada!',
      'Sua solicitação para entrar na equipe "' || COALESCE(team_name, 'equipe') || '" foi aprovada!',
      'success',
      '/teams/' || NEW.team_id
    );
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      NEW.user_id,
      'Solicitação rejeitada',
      'Sua solicitação para entrar na equipe "' || COALESCE(team_name, 'equipe') || '" foi rejeitada.',
      'error',
      '/welcome'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to fire when join request status changes
CREATE TRIGGER on_team_join_request_responded
  AFTER UPDATE ON team_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_team_join_request_responded();