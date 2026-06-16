-- Create function to notify when adjustment is completed (demand goes from "Em Ajuste" back to "Entregue")
CREATE OR REPLACE FUNCTION public.notify_adjustment_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  old_status_name TEXT;
  new_status_name TEXT;
  creator_name TEXT;
BEGIN
  -- Only trigger if status actually changed
  IF OLD.status_id = NEW.status_id THEN
    RETURN NEW;
  END IF;
  
  -- Get status names
  SELECT name INTO old_status_name FROM demand_statuses WHERE id = OLD.status_id;
  SELECT name INTO new_status_name FROM demand_statuses WHERE id = NEW.status_id;
  
  -- Only notify if going from "Em Ajuste" to "Entregue"
  IF old_status_name = 'Em Ajuste' AND new_status_name = 'Entregue' THEN
    -- Get creator name
    SELECT full_name INTO creator_name FROM profiles WHERE id = NEW.created_by;
    
    -- Create in-app notification for the creator
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      NEW.created_by,
      'Ajuste concluído',
      'O ajuste na demanda "' || NEW.title || '" foi finalizado. A demanda voltou para Entregue.',
      'success',
      '/demands/' || NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for adjustment completion notification
DROP TRIGGER IF EXISTS notify_adjustment_completed_trigger ON demands;
CREATE TRIGGER notify_adjustment_completed_trigger
  AFTER UPDATE ON demands
  FOR EACH ROW
  EXECUTE FUNCTION notify_adjustment_completed();