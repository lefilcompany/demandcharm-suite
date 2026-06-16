ALTER TABLE public.demand_folder_shares 
ADD COLUMN permission text NOT NULL DEFAULT 'view';
