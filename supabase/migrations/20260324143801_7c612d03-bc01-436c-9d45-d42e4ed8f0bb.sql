
-- Add status_changed_at column to demands
ALTER TABLE public.demands ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Backfill: set status_changed_at to updated_at for existing rows
UPDATE public.demands SET status_changed_at = updated_at WHERE status_changed_at IS NULL;

-- Create trigger function to auto-update status_changed_at when status_id changes
CREATE OR REPLACE FUNCTION public.update_status_changed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_status_changed_at ON public.demands;
CREATE TRIGGER trigger_update_status_changed_at
  BEFORE UPDATE ON public.demands
  FOR EACH ROW
  EXECUTE FUNCTION public.update_status_changed_at();
