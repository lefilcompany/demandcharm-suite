ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS effort_points integer NOT NULL DEFAULT 5;

ALTER TABLE public.demands
  DROP CONSTRAINT IF EXISTS demands_effort_points_check;

ALTER TABLE public.demands
  ADD CONSTRAINT demands_effort_points_check
  CHECK (effort_points IN (1,2,3,5,8,13,21));