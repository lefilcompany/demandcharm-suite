ALTER TABLE public.demo_requests
ADD COLUMN internal_notes text;

COMMENT ON COLUMN public.demo_requests.internal_notes IS 'Admin-only notes for managing demo requests.';