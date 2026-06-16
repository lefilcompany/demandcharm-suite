-- Add fields to track time in progress
ALTER TABLE public.demands 
ADD COLUMN IF NOT EXISTS time_in_progress_seconds INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_started_at TIMESTAMP WITH TIME ZONE;

-- Create function to update time tracking on status changes
CREATE OR REPLACE FUNCTION public.update_time_in_progress()
RETURNS TRIGGER AS $$
DECLARE
  old_status_name TEXT;
  new_status_name TEXT;
  elapsed_seconds INTEGER;
BEGIN
  -- Get status names
  SELECT name INTO old_status_name FROM public.demand_statuses WHERE id = OLD.status_id;
  SELECT name INTO new_status_name FROM public.demand_statuses WHERE id = NEW.status_id;
  
  -- If leaving "Fazendo" status, accumulate the time
  IF old_status_name = 'Fazendo' AND new_status_name != 'Fazendo' THEN
    IF OLD.last_started_at IS NOT NULL THEN
      elapsed_seconds := EXTRACT(EPOCH FROM (now() - OLD.last_started_at))::INTEGER;
      NEW.time_in_progress_seconds := COALESCE(OLD.time_in_progress_seconds, 0) + elapsed_seconds;
    END IF;
    NEW.last_started_at := NULL;
  END IF;
  
  -- If entering "Fazendo" status, set the start time
  IF new_status_name = 'Fazendo' AND old_status_name != 'Fazendo' THEN
    NEW.last_started_at := now();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for status changes
DROP TRIGGER IF EXISTS track_time_in_progress ON public.demands;
CREATE TRIGGER track_time_in_progress
BEFORE UPDATE OF status_id ON public.demands
FOR EACH ROW
EXECUTE FUNCTION public.update_time_in_progress();