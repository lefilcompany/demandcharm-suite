-- Add interaction_id column to demand_attachments to link attachments to specific interactions
ALTER TABLE public.demand_attachments 
ADD COLUMN interaction_id uuid REFERENCES public.demand_interactions(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX idx_demand_attachments_interaction_id ON public.demand_attachments(interaction_id);