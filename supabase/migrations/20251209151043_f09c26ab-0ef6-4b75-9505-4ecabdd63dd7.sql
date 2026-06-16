-- Add archived column to demands table
ALTER TABLE public.demands ADD COLUMN archived boolean NOT NULL DEFAULT false;

-- Add archived_at timestamp
ALTER TABLE public.demands ADD COLUMN archived_at timestamp with time zone;

-- Create index for better query performance on archived demands
CREATE INDEX idx_demands_archived ON public.demands(archived);