CREATE OR REPLACE FUNCTION public.set_demand_delivered_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE new_is_delivered boolean; old_is_delivered boolean := false;
BEGIN
  SELECT lower(trim(name)) = 'entregue' INTO new_is_delivered FROM public.demand_statuses WHERE id = NEW.status_id;
  IF TG_OP = 'UPDATE' THEN
    SELECT lower(trim(name)) = 'entregue' INTO old_is_delivered FROM public.demand_statuses WHERE id = OLD.status_id;
  END IF;
  IF coalesce(new_is_delivered,false) AND NOT coalesce(old_is_delivered,false) THEN
    NEW.delivered_at := coalesce(NEW.delivered_at, now());
  ELSIF coalesce(old_is_delivered,false) AND NOT coalesce(new_is_delivered,false) THEN
    NEW.delivered_at := NULL;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trigger_set_demand_delivered_at ON public.demands;
CREATE TRIGGER trigger_set_demand_delivered_at
BEFORE INSERT OR UPDATE OF status_id ON public.demands
FOR EACH ROW EXECUTE FUNCTION public.set_demand_delivered_at();