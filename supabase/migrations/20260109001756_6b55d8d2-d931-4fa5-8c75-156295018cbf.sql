-- Add price_cents column to services table
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS price_cents INTEGER NOT NULL DEFAULT 0;

-- Add payment control columns to demand_requests table
ALTER TABLE public.demand_requests ADD COLUMN IF NOT EXISTS payment_required BOOLEAN DEFAULT true;
ALTER TABLE public.demand_requests ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'not_required';