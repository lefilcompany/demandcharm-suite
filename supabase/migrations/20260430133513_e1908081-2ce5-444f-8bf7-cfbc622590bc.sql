-- Fix is_overdue computation for delivered demands.
-- The previous trigger ran BEFORE the trigger that sets delivered_at, so when a
-- demand was just marked as "Entregue" via a status update, NEW.delivered_at was
-- still NULL and is_overdue was wrongly computed as false even when the due_date
-- had already passed. We now mirror the delivered_at default (now()) inside the
-- compute function so both paths agree, regardless of trigger firing order.
CREATE OR REPLACE FUNCTION public.compute_demand_is_overdue()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_delivered_status_id uuid;
  v_effective_delivered_at timestamptz;
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
    -- If delivered_at is missing (e.g. another BEFORE trigger will set it later
    -- in the same UPDATE), fall back to NOW() — which mirrors what
    -- set_demand_delivered_at() will assign.
    v_effective_delivered_at := COALESCE(NEW.delivered_at, now());

    IF v_effective_delivered_at > NEW.due_date THEN
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

-- Backfill: re-evaluate is_overdue for delivered demands so historical rows
-- (including ones marked as delivered after the previous broken trigger ran)
-- now correctly reflect "concluída com atraso".
WITH delivered AS (
  SELECT id FROM public.demand_statuses WHERE name = 'Entregue' LIMIT 1
)
UPDATE public.demands d
SET is_overdue = (
  d.delivered_at IS NOT NULL
  AND d.due_date IS NOT NULL
  AND d.delivered_at > d.due_date
)
WHERE d.status_id = (SELECT id FROM delivered);
