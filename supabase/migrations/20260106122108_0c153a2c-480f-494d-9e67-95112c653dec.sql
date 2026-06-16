-- Update notify_demand_created to notify only board members instead of all team members
CREATE OR REPLACE FUNCTION public.notify_demand_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  board_member RECORD;
  demand_title TEXT;
  creator_name TEXT;
BEGIN
  -- Get demand title and creator name
  demand_title := NEW.title;
  SELECT full_name INTO creator_name FROM profiles WHERE id = NEW.created_by;
  
  -- Notify only BOARD members (not all team members) except the creator
  FOR board_member IN 
    SELECT user_id FROM board_members 
    WHERE board_id = NEW.board_id 
    AND user_id != NEW.created_by
  LOOP
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      board_member.user_id,
      'Nova demanda criada',
      creator_name || ' criou a demanda "' || demand_title || '"',
      'info',
      '/demands/' || NEW.id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;