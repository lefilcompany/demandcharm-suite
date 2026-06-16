-- Fix 1: is_team_admin_or_moderator to include moderator role
CREATE OR REPLACE FUNCTION public.is_team_admin_or_moderator(_user_id uuid, _team_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE user_id = _user_id
      AND team_id = _team_id
      AND role IN ('admin', 'moderator')
  )
$$;

-- Fix 2: is_team_admin_or_moderator_for_board to include moderator role
CREATE OR REPLACE FUNCTION public.is_team_admin_or_moderator_for_board(_user_id uuid, _board_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    JOIN public.boards b ON b.team_id = tm.team_id
    WHERE tm.user_id = _user_id AND b.id = _board_id AND tm.role IN ('admin', 'moderator')
  )
$$;

-- Fix 3: Set search_path on functions missing it
CREATE OR REPLACE FUNCTION public.update_status_changed_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_demand_delivered_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  delivered_status_id UUID;
BEGIN
  SELECT id INTO delivered_status_id 
  FROM public.demand_statuses 
  WHERE name = 'Entregue' 
  LIMIT 1;
  
  IF NEW.status_id = delivered_status_id AND (OLD.status_id IS NULL OR OLD.status_id != delivered_status_id) THEN
    NEW.delivered_at = NOW();
  END IF;
  
  IF OLD.status_id = delivered_status_id AND NEW.status_id != delivered_status_id THEN
    NEW.delivered_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;