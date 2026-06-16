
-- 1) Add column
ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS is_overdue boolean NOT NULL DEFAULT false;

-- 2) Trigger function to compute is_overdue
CREATE OR REPLACE FUNCTION public.compute_demand_is_overdue()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_delivered_status_id uuid;
BEGIN
  -- If no due_date, never overdue
  IF NEW.due_date IS NULL THEN
    NEW.is_overdue := false;
    RETURN NEW;
  END IF;

  SELECT id INTO v_delivered_status_id
  FROM public.demand_statuses
  WHERE name = 'Entregue'
  LIMIT 1;

  IF NEW.status_id = v_delivered_status_id THEN
    -- Delivered: overdue iff delivered_at > due_date
    IF NEW.delivered_at IS NOT NULL AND NEW.delivered_at > NEW.due_date THEN
      NEW.is_overdue := true;
    ELSE
      NEW.is_overdue := false;
    END IF;
  ELSE
    -- Not delivered: overdue iff due_date < now()
    IF NEW.due_date < now() THEN
      NEW.is_overdue := true;
    ELSE
      NEW.is_overdue := false;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_demand_is_overdue ON public.demands;
CREATE TRIGGER trg_compute_demand_is_overdue
BEFORE INSERT OR UPDATE OF due_date, status_id, delivered_at
ON public.demands
FOR EACH ROW
EXECUTE FUNCTION public.compute_demand_is_overdue();

-- 3) Backfill existing demands
WITH delivered AS (
  SELECT id FROM public.demand_statuses WHERE name = 'Entregue' LIMIT 1
)
UPDATE public.demands d
SET is_overdue = CASE
  WHEN d.due_date IS NULL THEN false
  WHEN d.status_id = (SELECT id FROM delivered)
    THEN (d.delivered_at IS NOT NULL AND d.delivered_at > d.due_date)
  ELSE (d.due_date < now())
END;

-- 4) Index for filtering
CREATE INDEX IF NOT EXISTS idx_demands_is_overdue
  ON public.demands (is_overdue)
  WHERE is_overdue = true;

-- 5) RPC to refresh overdue flags for all non-delivered demands (used by cron)
CREATE OR REPLACE FUNCTION public.refresh_overdue_demands()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_delivered_status_id uuid;
  v_count integer;
BEGIN
  SELECT id INTO v_delivered_status_id
  FROM public.demand_statuses
  WHERE name = 'Entregue'
  LIMIT 1;

  WITH updated AS (
    UPDATE public.demands
    SET is_overdue = true
    WHERE archived = false
      AND due_date IS NOT NULL
      AND due_date < now()
      AND (status_id IS DISTINCT FROM v_delivered_status_id)
      AND is_overdue = false
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM updated;

  RETURN v_count;
END;
$$;
