
-- Normalize due_date to end-of-day (23:59:59 UTC) so a demand is only overdue when current time > end of due day.

-- 1) Trigger: enforce 23:59:59 of the same UTC calendar day whenever due_date is set.
CREATE OR REPLACE FUNCTION public.normalize_demand_due_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.due_date IS NOT NULL THEN
    NEW.due_date := date_trunc('day', NEW.due_date AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
                    + INTERVAL '23 hours 59 minutes 59 seconds';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_demand_due_date ON public.demands;
CREATE TRIGGER trg_normalize_demand_due_date
BEFORE INSERT OR UPDATE OF due_date ON public.demands
FOR EACH ROW
EXECUTE FUNCTION public.normalize_demand_due_date();

-- 2) Backfill: shift all existing due_dates to 23:59:59 UTC of their calendar day.
UPDATE public.demands
SET due_date = date_trunc('day', due_date AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
               + INTERVAL '23 hours 59 minutes 59 seconds'
WHERE due_date IS NOT NULL
  AND due_date <> date_trunc('day', due_date AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
                  + INTERVAL '23 hours 59 minutes 59 seconds';

-- 3) Recompute is_overdue for all demands using the existing trigger function logic.
UPDATE public.demands d
SET is_overdue = CASE
  WHEN d.due_date IS NULL THEN false
  WHEN d.delivered_at IS NOT NULL OR EXISTS (
    SELECT 1 FROM public.demand_statuses s
    WHERE s.id = d.status_id AND s.name = 'Entregue'
  )
    THEN (
      COALESCE(d.delivered_at, d.updated_at) > d.due_date
    )
  ELSE (d.due_date < now())
END;
