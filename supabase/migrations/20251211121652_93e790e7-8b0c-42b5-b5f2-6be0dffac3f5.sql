-- Função para notificar quando alguém é atribuído a uma demanda
CREATE OR REPLACE FUNCTION public.notify_assignee_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demand_title TEXT;
BEGIN
  -- Buscar título da demanda
  SELECT title INTO demand_title FROM demands WHERE id = NEW.demand_id;
  
  -- Notificar o usuário atribuído
  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (
    NEW.user_id,
    'Você foi atribuído a uma demanda',
    'Você foi designado para trabalhar na demanda "' || demand_title || '"',
    'info',
    '/demands/' || NEW.demand_id
  );
  
  RETURN NEW;
END;
$$;

-- Trigger para INSERT na tabela demand_assignees
CREATE TRIGGER on_assignee_added
  AFTER INSERT ON demand_assignees
  FOR EACH ROW
  EXECUTE FUNCTION notify_assignee_added();