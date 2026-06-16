-- Function to create notification for demand creation
CREATE OR REPLACE FUNCTION public.notify_demand_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  team_member RECORD;
  demand_title TEXT;
  creator_name TEXT;
BEGIN
  -- Get demand title and creator name
  demand_title := NEW.title;
  SELECT full_name INTO creator_name FROM profiles WHERE id = NEW.created_by;
  
  -- Notify all team members except the creator
  FOR team_member IN 
    SELECT user_id FROM team_members WHERE team_id = NEW.team_id AND user_id != NEW.created_by
  LOOP
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      team_member.user_id,
      'Nova demanda criada',
      creator_name || ' criou a demanda "' || demand_title || '"',
      'info',
      '/demands/' || NEW.id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Function to create notification for demand status change
CREATE OR REPLACE FUNCTION public.notify_demand_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_status_name TEXT;
  new_status_name TEXT;
  demand_creator UUID;
  assigned_user UUID;
BEGIN
  -- Only trigger if status actually changed
  IF OLD.status_id = NEW.status_id THEN
    RETURN NEW;
  END IF;
  
  -- Get status names
  SELECT name INTO old_status_name FROM demand_statuses WHERE id = OLD.status_id;
  SELECT name INTO new_status_name FROM demand_statuses WHERE id = NEW.status_id;
  
  demand_creator := NEW.created_by;
  assigned_user := NEW.assigned_to;
  
  -- Notify the creator if they didn't make the change
  IF demand_creator IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      demand_creator,
      'Status atualizado',
      'A demanda "' || NEW.title || '" mudou de "' || old_status_name || '" para "' || new_status_name || '"',
      CASE WHEN new_status_name = 'Entregue' THEN 'success' ELSE 'info' END,
      '/demands/' || NEW.id
    );
  END IF;
  
  -- Notify assigned user if different from creator
  IF assigned_user IS NOT NULL AND assigned_user != demand_creator THEN
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      assigned_user,
      'Status atualizado',
      'A demanda "' || NEW.title || '" mudou de "' || old_status_name || '" para "' || new_status_name || '"',
      CASE WHEN new_status_name = 'Entregue' THEN 'success' ELSE 'info' END,
      '/demands/' || NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to create notification for demand assignment
CREATE OR REPLACE FUNCTION public.notify_demand_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demand_record RECORD;
BEGIN
  -- Only trigger if assigned_to changed and is not null
  IF NEW.assigned_to IS NULL OR (OLD.assigned_to IS NOT NULL AND OLD.assigned_to = NEW.assigned_to) THEN
    RETURN NEW;
  END IF;
  
  -- Notify the newly assigned user
  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (
    NEW.assigned_to,
    'Demanda atribuída a você',
    'Você foi atribuído à demanda "' || NEW.title || '"',
    'info',
    '/demands/' || NEW.id
  );
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER on_demand_created
  AFTER INSERT ON demands
  FOR EACH ROW
  EXECUTE FUNCTION notify_demand_created();

CREATE TRIGGER on_demand_status_changed
  AFTER UPDATE ON demands
  FOR EACH ROW
  EXECUTE FUNCTION notify_demand_status_changed();

CREATE TRIGGER on_demand_assigned
  AFTER UPDATE ON demands
  FOR EACH ROW
  EXECUTE FUNCTION notify_demand_assigned();