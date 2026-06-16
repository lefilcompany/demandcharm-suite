-- Add is_primary column to demand_assignees to mark THE responsible user
ALTER TABLE public.demand_assignees
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

-- Backfill: for each demand, mark the earliest assigned user as primary if none exists
WITH ranked AS (
  SELECT id,
         demand_id,
         ROW_NUMBER() OVER (PARTITION BY demand_id ORDER BY assigned_at NULLS LAST, id) AS rn
  FROM public.demand_assignees
),
demands_without_primary AS (
  SELECT da.demand_id
  FROM public.demand_assignees da
  GROUP BY da.demand_id
  HAVING bool_or(da.is_primary) = false
)
UPDATE public.demand_assignees da
SET is_primary = true
FROM ranked r
WHERE da.id = r.id
  AND r.rn = 1
  AND da.demand_id IN (SELECT demand_id FROM demands_without_primary);

-- Ensure at most one primary per demand via partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS demand_assignees_one_primary_per_demand
  ON public.demand_assignees(demand_id)
  WHERE is_primary = true;