-- Add scope and limit fields to teams table
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS scope_description text,
ADD COLUMN IF NOT EXISTS contract_start_date date,
ADD COLUMN IF NOT EXISTS contract_end_date date,
ADD COLUMN IF NOT EXISTS monthly_demand_limit integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;

-- Create function to get monthly demand count for a team
CREATE OR REPLACE FUNCTION public.get_monthly_demand_count(_team_id uuid, _month integer, _year integer)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM public.demands
  WHERE team_id = _team_id
    AND EXTRACT(MONTH FROM created_at) = _month
    AND EXTRACT(YEAR FROM created_at) = _year
    AND archived = false
$$;

-- Create function to check if team can create more demands
CREATE OR REPLACE FUNCTION public.can_create_demand(_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE 
    WHEN (SELECT monthly_demand_limit FROM public.teams WHERE id = _team_id) = 0 THEN true
    ELSE (
      SELECT COUNT(*) < (SELECT monthly_demand_limit FROM public.teams WHERE id = _team_id)
      FROM public.demands
      WHERE team_id = _team_id
        AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM NOW())
        AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
        AND archived = false
    )
  END
$$;