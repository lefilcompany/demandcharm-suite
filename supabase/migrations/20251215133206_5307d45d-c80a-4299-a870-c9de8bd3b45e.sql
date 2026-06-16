-- Remove the existing constraint
ALTER TABLE public.demand_interactions 
DROP CONSTRAINT IF EXISTS demand_interactions_interaction_type_check;

-- Add new constraint including adjustment_request
ALTER TABLE public.demand_interactions 
ADD CONSTRAINT demand_interactions_interaction_type_check 
CHECK (interaction_type = ANY (ARRAY['comment'::text, 'status_change'::text, 'assignment'::text, 'update'::text, 'adjustment_request'::text]));