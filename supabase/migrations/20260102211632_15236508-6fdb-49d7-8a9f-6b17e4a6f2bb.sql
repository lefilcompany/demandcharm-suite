-- Update the trigger to also track who made the change and notify via edge function
-- We'll update the notify_demand_status_changed function to include all assignees

CREATE OR REPLACE FUNCTION public.notify_demand_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_status_name TEXT;
  new_status_name TEXT;
  assignee RECORD;
  notification_type TEXT;
BEGIN
  -- Only trigger if status actually changed
  IF OLD.status_id = NEW.status_id THEN
    RETURN NEW;
  END IF;
  
  -- Get status names
  SELECT name INTO old_status_name FROM demand_statuses WHERE id = OLD.status_id;
  SELECT name INTO new_status_name FROM demand_statuses WHERE id = NEW.status_id;
  
  -- Determine notification type based on new status
  notification_type := CASE 
    WHEN new_status_name = 'Entregue' THEN 'success'
    WHEN new_status_name = 'Em Ajuste' THEN 'warning'
    ELSE 'info'
  END;
  
  -- Always notify the creator (solicitante)
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      NEW.created_by,
      'Status atualizado',
      'A demanda "' || NEW.title || '" mudou de "' || old_status_name || '" para "' || new_status_name || '"',
      notification_type,
      '/demands/' || NEW.id
    );
  END IF;
  
  -- Notify all assignees (except creator to avoid duplicate)
  FOR assignee IN 
    SELECT user_id FROM demand_assignees WHERE demand_id = NEW.id AND user_id != NEW.created_by
  LOOP
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      assignee.user_id,
      'Status atualizado',
      'A demanda "' || NEW.title || '" mudou de "' || old_status_name || '" para "' || new_status_name || '"',
      notification_type,
      '/demands/' || NEW.id
    );
  END LOOP;
  
  -- Also notify legacy assigned_to if different from creator and not in assignees
  IF NEW.assigned_to IS NOT NULL 
     AND NEW.assigned_to != NEW.created_by 
     AND NOT EXISTS (SELECT 1 FROM demand_assignees WHERE demand_id = NEW.id AND user_id = NEW.assigned_to) 
  THEN
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      NEW.assigned_to,
      'Status atualizado',
      'A demanda "' || NEW.title || '" mudou de "' || old_status_name || '" para "' || new_status_name || '"',
      notification_type,
      '/demands/' || NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;