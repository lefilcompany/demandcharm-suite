
ALTER TABLE public.demands DROP CONSTRAINT IF EXISTS demands_status_id_fkey;
ALTER TABLE public.demands ADD CONSTRAINT demands_status_id_fkey
  FOREIGN KEY (status_id) REFERENCES public.demand_statuses(id) ON DELETE CASCADE;

ALTER TABLE public.recurring_demands DROP CONSTRAINT IF EXISTS recurring_demands_status_id_fkey;
ALTER TABLE public.recurring_demands ADD CONSTRAINT recurring_demands_status_id_fkey
  FOREIGN KEY (status_id) REFERENCES public.demand_statuses(id) ON DELETE CASCADE;
