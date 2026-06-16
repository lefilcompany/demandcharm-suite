
CREATE OR REPLACE FUNCTION public.notify_mention()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  mentioned_user_id UUID;
  demand_title TEXT;
  demand_board_id UUID;
  is_board_member BOOLEAN;
  mention_match TEXT[];
BEGIN
  -- Get demand info including board_id
  SELECT title, board_id INTO demand_title, demand_board_id 
  FROM demands WHERE id = NEW.demand_id;
  
  -- Find all mentions in [[user_id:Name]] format
  FOR mention_match IN 
    SELECT regexp_matches(NEW.content, '\[\[([0-9a-f-]+):([^\]]+)\]\]', 'g')
  LOOP
    mentioned_user_id := mention_match[1]::UUID;
    
    -- Skip self-mentions
    IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.user_id THEN
      -- Check board membership
      SELECT EXISTS(
        SELECT 1 FROM board_members 
        WHERE board_id = demand_board_id 
        AND user_id = mentioned_user_id
      ) INTO is_board_member;
      
      -- Only notify if board member
      IF is_board_member THEN
        INSERT INTO notifications (user_id, title, message, type, link)
        VALUES (
          mentioned_user_id,
          'Você foi mencionado',
          'Você foi mencionado em um comentário na demanda "' || left(demand_title, 100) || '"',
          'info',
          '/demands/' || NEW.demand_id
        );
      END IF;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$function$;
