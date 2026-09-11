DROP FUNCTION IF EXISTS public.create_demand_assignee_notification(uuid, uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.notify_demand_assignee_membership_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_demand_title text;
  v_target_user uuid;
  v_title text;
  v_message text;
  v_type text := 'info';
BEGIN
  v_target_user := COALESCE(NEW.user_id, OLD.user_id);
  IF v_target_user IS NULL OR v_actor IS NULL OR v_target_user = v_actor THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(NULLIF(trim(p.full_name), ''), 'Alguém')
    INTO v_actor_name
    FROM public.profiles p
   WHERE p.id = v_actor;

  SELECT d.title
    INTO v_demand_title
    FROM public.demands d
   WHERE d.id = COALESCE(NEW.demand_id, OLD.demand_id);

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_primary THEN
      v_title := 'Você é o responsável por uma demanda';
      v_message := format('%s definiu você como responsável principal da demanda "%s".', COALESCE(v_actor_name, 'Alguém'), COALESCE(v_demand_title, 'Sem título'));
    ELSE
      v_title := 'Você foi adicionado como seguidor';
      v_message := format('%s adicionou você como seguidor da demanda "%s".', COALESCE(v_actor_name, 'Alguém'), COALESCE(v_demand_title, 'Sem título'));
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_title := 'Você foi removido de uma demanda';
    v_message := format('%s removeu você dos responsáveis da demanda "%s".', COALESCE(v_actor_name, 'Alguém'), COALESCE(v_demand_title, 'Sem título'));
    v_type := 'warning';
  ELSIF OLD.is_primary IS DISTINCT FROM NEW.is_primary AND NEW.is_primary THEN
    v_title := 'Você agora é o responsável principal';
    v_message := format('%s promoveu você a responsável principal da demanda "%s".', COALESCE(v_actor_name, 'Alguém'), COALESCE(v_demand_title, 'Sem título'));
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    v_target_user,
    v_title,
    v_message,
    v_type,
    '/demands/' || COALESCE(NEW.demand_id, OLD.demand_id)::text
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_demand_assignee_membership_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_demand_assignee_membership_change() TO service_role;

DROP TRIGGER IF EXISTS trg_notify_demand_assignee_membership_change ON public.demand_assignees;
CREATE TRIGGER trg_notify_demand_assignee_membership_change
AFTER INSERT OR UPDATE OF is_primary OR DELETE ON public.demand_assignees
FOR EACH ROW EXECUTE FUNCTION public.notify_demand_assignee_membership_change();