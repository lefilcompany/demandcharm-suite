CREATE OR REPLACE FUNCTION public.notify_demand_request_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  responder_name text;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT NULLIF(trim(full_name), '')
  INTO responder_name
  FROM public.profiles
  WHERE id = NEW.responded_by;

  responder_name := COALESCE(responder_name, 'um aprovador');

  IF NEW.status = 'approved' THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.created_by,
      'Solicitação aprovada!',
      'Sua solicitação de demanda "' || NEW.title || '" foi aprovada por ' || responder_name,
      'success',
      '/demands'
    );
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.created_by,
      'Solicitação rejeitada',
      'Sua solicitação "' || NEW.title || '" foi rejeitada. Motivo: ' || COALESCE(NEW.rejection_reason, 'Não informado'),
      'error',
      '/my-requests'
    );
  ELSIF NEW.status = 'returned' THEN
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
      NEW.created_by,
      'Solicitação devolvida para revisão',
      'Sua solicitação "' || NEW.title || '" foi devolvida: ' || COALESCE(NEW.rejection_reason, 'Ajustes necessários'),
      'warning',
      '/my-requests'
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_demand_request_status_changed() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_demand_request_status_changed() FROM anon;
GRANT EXECUTE ON FUNCTION public.notify_demand_request_status_changed() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_demand_request_status_changed() TO service_role;