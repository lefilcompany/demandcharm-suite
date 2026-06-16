-- 1. Atualizar notify_demand_request_created para filtrar por board_members
CREATE OR REPLACE FUNCTION public.notify_demand_request_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_member RECORD;
  requester_name TEXT;
  team_name TEXT;
BEGIN
  -- Get requester name and team name
  SELECT full_name INTO requester_name FROM profiles WHERE id = NEW.created_by;
  SELECT name INTO team_name FROM teams WHERE id = NEW.team_id;
  
  -- Se tem board_id, notifica apenas admins/moderators desse quadro
  IF NEW.board_id IS NOT NULL THEN
    FOR admin_member IN 
      SELECT user_id FROM board_members 
      WHERE board_id = NEW.board_id 
      AND role IN ('admin', 'moderator')
      AND user_id != NEW.created_by
    LOOP
      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES (
        admin_member.user_id,
        'Nova solicitação de demanda',
        requester_name || ' solicitou a criação de uma demanda: "' || NEW.title || '"',
        'info',
        '/demand-requests'
      );
    END LOOP;
  ELSE
    -- Fallback: notifica admins da equipe (para requests antigos sem board_id)
    FOR admin_member IN 
      SELECT user_id FROM team_members 
      WHERE team_id = NEW.team_id 
      AND role IN ('admin', 'moderator')
      AND user_id != NEW.created_by
    LOOP
      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES (
        admin_member.user_id,
        'Nova solicitação de demanda',
        requester_name || ' solicitou a criação de uma demanda: "' || NEW.title || '"',
        'info',
        '/demand-requests'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 2. Atualizar notify_mention para verificar membership do quadro
CREATE OR REPLACE FUNCTION public.notify_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mentioned_user_id UUID;
  mention_pattern TEXT;
  demand_title TEXT;
  demand_board_id UUID;
  sanitized_pattern TEXT;
  is_board_member BOOLEAN;
BEGIN
  -- Get demand info including board_id
  SELECT title, board_id INTO demand_title, demand_board_id 
  FROM demands WHERE id = NEW.demand_id;
  
  -- Find all @mentions in content using regex
  FOR mention_pattern IN 
    SELECT (regexp_matches(NEW.content, '@([a-zA-Z0-9_-]+)', 'g'))[1]
  LOOP
    -- Sanitize the pattern: only allow alphanumeric, underscore, and hyphen
    sanitized_pattern := regexp_replace(mention_pattern, '[^a-zA-Z0-9_-]', '', 'g');
    
    -- Skip if pattern is empty after sanitization
    IF length(sanitized_pattern) = 0 THEN
      CONTINUE;
    END IF;
    
    -- Find user by exact name match (case insensitive) using parameterized approach
    SELECT id INTO mentioned_user_id 
    FROM profiles 
    WHERE LOWER(full_name) = LOWER(sanitized_pattern)
    LIMIT 1;
    
    -- If exact match not found, try partial match with proper escaping
    IF mentioned_user_id IS NULL THEN
      SELECT id INTO mentioned_user_id 
      FROM profiles 
      WHERE full_name ILIKE '%' || replace(replace(sanitized_pattern, '%', '\%'), '_', '\_') || '%'
      LIMIT 1;
    END IF;
    
    -- Verificar se o usuário é membro do quadro antes de notificar
    IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.user_id THEN
      -- Verificar membership do quadro
      SELECT EXISTS(
        SELECT 1 FROM board_members 
        WHERE board_id = demand_board_id 
        AND user_id = mentioned_user_id
      ) INTO is_board_member;
      
      -- Apenas notificar se for membro do quadro
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
$$;