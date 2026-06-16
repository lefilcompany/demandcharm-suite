-- Create table for demand request attachments
CREATE TABLE public.demand_request_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_request_id UUID NOT NULL REFERENCES public.demand_requests(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demand_request_attachments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can upload attachments to their own requests
CREATE POLICY "Users can upload attachments to own requests"
ON public.demand_request_attachments
FOR INSERT
WITH CHECK (
  uploaded_by = auth.uid() AND
  demand_request_id IN (
    SELECT id FROM public.demand_requests WHERE created_by = auth.uid()
  )
);

-- Policy: Users can view attachments of their own requests
CREATE POLICY "Users can view own request attachments"
ON public.demand_request_attachments
FOR SELECT
USING (
  demand_request_id IN (
    SELECT id FROM public.demand_requests WHERE created_by = auth.uid()
  )
);

-- Policy: Admins/moderators can view request attachments
CREATE POLICY "Admins can view request attachments"
ON public.demand_request_attachments
FOR SELECT
USING (
  demand_request_id IN (
    SELECT id FROM public.demand_requests 
    WHERE is_team_admin_or_moderator(auth.uid(), team_id)
  )
);

-- Policy: Users can delete their own attachments
CREATE POLICY "Users can delete own request attachments"
ON public.demand_request_attachments
FOR DELETE
USING (uploaded_by = auth.uid());