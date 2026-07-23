ALTER TABLE public.demand_requests
  ADD COLUMN IF NOT EXISTS subdemands_plan JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.demand_request_attachments
  ADD COLUMN IF NOT EXISTS subdemand_index INTEGER;