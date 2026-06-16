-- Add delivered_at column to track when demand was actually delivered
ALTER TABLE public.demands 
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ DEFAULT NULL;

-- Create a function to automatically set delivered_at when status changes to "Entregue"
CREATE OR REPLACE FUNCTION public.set_demand_delivered_at()
RETURNS TRIGGER AS $$
DECLARE
  delivered_status_id UUID;
BEGIN
  -- Get the "Entregue" status ID
  SELECT id INTO delivered_status_id 
  FROM public.demand_statuses 
  WHERE name = 'Entregue' 
  LIMIT 1;
  
  -- If status is changing to "Entregue", set delivered_at
  IF NEW.status_id = delivered_status_id AND (OLD.status_id IS NULL OR OLD.status_id != delivered_status_id) THEN
    NEW.delivered_at = NOW();
  END IF;
  
  -- If status is changing away from "Entregue", clear delivered_at
  IF OLD.status_id = delivered_status_id AND NEW.status_id != delivered_status_id THEN
    NEW.delivered_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_demand_delivered_at ON public.demands;
CREATE TRIGGER trigger_set_demand_delivered_at
  BEFORE UPDATE ON public.demands
  FOR EACH ROW
  EXECUTE FUNCTION public.set_demand_delivered_at();

-- Update existing delivered demands to set delivered_at based on updated_at
UPDATE public.demands d
SET delivered_at = d.updated_at
WHERE d.status_id IN (SELECT id FROM public.demand_statuses WHERE name = 'Entregue')
AND d.delivered_at IS NULL;