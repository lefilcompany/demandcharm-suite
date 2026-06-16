-- Update the trigger function to pause any active timer before starting a new one
CREATE OR REPLACE FUNCTION public.update_time_in_progress()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  old_status_name TEXT;
  new_status_name TEXT;
  elapsed_seconds INTEGER;
  running_demand RECORD;
BEGIN
  -- Get status names
  SELECT name INTO old_status_name FROM public.demand_statuses WHERE id = OLD.status_id;
  SELECT name INTO new_status_name FROM public.demand_statuses WHERE id = NEW.status_id;
  
  -- If leaving "Fazendo" or "Em Ajuste" status, accumulate the time
  IF (old_status_name IN ('Fazendo', 'Em Ajuste')) AND (new_status_name NOT IN ('Fazendo', 'Em Ajuste')) THEN
    IF OLD.last_started_at IS NOT NULL THEN
      elapsed_seconds := EXTRACT(EPOCH FROM (now() - OLD.last_started_at))::INTEGER;
      NEW.time_in_progress_seconds := COALESCE(OLD.time_in_progress_seconds, 0) + elapsed_seconds;
    END IF;
    NEW.last_started_at := NULL;
  END IF;
  
  -- If entering "Fazendo" status, start the timer (but first pause any other active timer in the same team)
  IF new_status_name = 'Fazendo' AND old_status_name != 'Fazendo' THEN
    -- Find and pause any other demand with active timer in the same team
    FOR running_demand IN 
      SELECT id, last_started_at, time_in_progress_seconds 
      FROM public.demands 
      WHERE team_id = NEW.team_id 
        AND last_started_at IS NOT NULL 
        AND id != NEW.id
    LOOP
      -- Calculate elapsed time and pause
      elapsed_seconds := EXTRACT(EPOCH FROM (now() - running_demand.last_started_at))::INTEGER;
      
      UPDATE public.demands 
      SET 
        last_started_at = NULL,
        time_in_progress_seconds = COALESCE(running_demand.time_in_progress_seconds, 0) + elapsed_seconds
      WHERE id = running_demand.id;
    END LOOP;
    
    -- Now start the timer for this demand
    NEW.last_started_at := now();
  END IF;
  
  RETURN NEW;
END;
$function$;