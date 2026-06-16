-- Rename column from estimated_days to estimated_hours
ALTER TABLE public.services RENAME COLUMN estimated_days TO estimated_hours;

-- Update default value (7 days = 168 hours, but let's use 24 hours as a more reasonable default)
ALTER TABLE public.services ALTER COLUMN estimated_hours SET DEFAULT 24;