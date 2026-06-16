
-- 1. Recriar notify_demand_created: notifica apenas ADMINS do quadro (não todos os membros)
CREATE OR REPLACE FUNCTION public.notify_demand_created()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  board_admin RECORD;
  demand_title TEXT;
  creator_name TEXT;
BEGIN
  demand_title := NEW.title;
  SELECT full_name INTO creator_name FROM profiles WHERE id = NEW.created_by;
  
  -- Notifica apenas ADMINS do quadro (exceto o criador)
  FOR board_admin IN 
    SELECT user_id FROM board_members 
    WHERE board_id = NEW.board_id 
    AND role = 'admin'
    AND user_id != NEW.created_by
  LOOP
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      board_admin.user_id,
      'Nova demanda criada',
      creator_name || ' criou a demanda "' || demand_title || '"',
      'info',
      '/demands/' || NEW.id
    );
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- 2. Recriar notify_demand_status_changed: notifica criador + assignees + admins do board (sem duplicatas)
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
  board_admin RECORD;
  notification_type TEXT;
  notified_users UUID[];
BEGIN
  IF OLD.status_id = NEW.status_id THEN
    RETURN NEW;
  END IF;
  
  SELECT name INTO old_status_name FROM demand_statuses WHERE id = OLD.status_id;
  SELECT name INTO new_status_name FROM demand_statuses WHERE id = NEW.status_id;
  
  notification_type := CASE 
    WHEN new_status_name = 'Entregue' THEN 'success'
    WHEN new_status_name = 'Em Ajuste' THEN 'warning'
    ELSE 'info'
  END;
  
  notified_users := ARRAY[]::UUID[];
  
  -- Notifica o criador (solicitante)
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      NEW.created_by,
      'Status atualizado',
      'A demanda "' || NEW.title || '" mudou de "' || old_status_name || '" para "' || new_status_name || '"',
      notification_type,
      '/demands/' || NEW.id
    );
    notified_users := array_append(notified_users, NEW.created_by);
  END IF;
  
  -- Notifica assignees (exceto já notificados)
  FOR assignee IN 
    SELECT user_id FROM demand_assignees WHERE demand_id = NEW.id AND user_id != ALL(notified_users)
  LOOP
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      assignee.user_id,
      'Status atualizado',
      'A demanda "' || NEW.title || '" mudou de "' || old_status_name || '" para "' || new_status_name || '"',
      notification_type,
      '/demands/' || NEW.id
    );
    notified_users := array_append(notified_users, assignee.user_id);
  END LOOP;
  
  -- Notifica legacy assigned_to (exceto já notificados)
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != ALL(notified_users) THEN
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      NEW.assigned_to,
      'Status atualizado',
      'A demanda "' || NEW.title || '" mudou de "' || old_status_name || '" para "' || new_status_name || '"',
      notification_type,
      '/demands/' || NEW.id
    );
    notified_users := array_append(notified_users, NEW.assigned_to);
  END IF;
  
  -- Notifica ADMINS do quadro (exceto já notificados)
  FOR board_admin IN 
    SELECT user_id FROM board_members 
    WHERE board_id = NEW.board_id 
    AND role = 'admin'
    AND user_id != ALL(notified_users)
  LOOP
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      board_admin.user_id,
      'Status atualizado',
      'A demanda "' || NEW.title || '" mudou de "' || old_status_name || '" para "' || new_status_name || '"',
      notification_type,
      '/demands/' || NEW.id
    );
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- 3. Recriar notify_adjustment_completed: notifica criador + admins do board (sem duplicatas)
CREATE OR REPLACE FUNCTION public.notify_adjustment_completed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_status_name TEXT;
  new_status_name TEXT;
  board_admin RECORD;
BEGIN
  IF OLD.status_id = NEW.status_id THEN
    RETURN NEW;
  END IF;
  
  SELECT name INTO old_status_name FROM demand_statuses WHERE id = OLD.status_id;
  SELECT name INTO new_status_name FROM demand_statuses WHERE id = NEW.status_id;
  
  IF old_status_name = 'Em Ajuste' AND new_status_name = 'Entregue' THEN
    -- Notifica o criador
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      NEW.created_by,
      'Ajuste concluído',
      'O ajuste na demanda "' || NEW.title || '" foi finalizado. A demanda voltou para Entregue.',
      'success',
      '/demands/' || NEW.id
    );
    
    -- Notifica admins do quadro (exceto criador)
    FOR board_admin IN 
      SELECT user_id FROM board_members 
      WHERE board_id = NEW.board_id 
      AND role = 'admin'
      AND user_id != NEW.created_by
    LOOP
      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES (
        board_admin.user_id,
        'Ajuste concluído',
        'O ajuste na demanda "' || NEW.title || '" foi finalizado. A demanda voltou para Entregue.',
        'success',
        '/demands/' || NEW.id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;
