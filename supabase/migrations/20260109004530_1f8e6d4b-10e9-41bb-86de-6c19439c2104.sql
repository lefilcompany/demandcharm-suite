-- Create contracts table for storing team contracts
CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  original_content TEXT,
  processed_content TEXT,
  file_url TEXT,
  file_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- Team members can view contracts
CREATE POLICY "Team members can view contracts"
ON public.contracts
FOR SELECT
USING (public.is_team_member(auth.uid(), team_id));

-- Only admins and moderators can insert contracts
CREATE POLICY "Admins and moderators can insert contracts"
ON public.contracts
FOR INSERT
WITH CHECK (public.is_team_admin_or_moderator(auth.uid(), team_id));

-- Only admins and moderators can update contracts
CREATE POLICY "Admins and moderators can update contracts"
ON public.contracts
FOR UPDATE
USING (public.is_team_admin_or_moderator(auth.uid(), team_id));

-- Only admins and moderators can delete contracts
CREATE POLICY "Admins and moderators can delete contracts"
ON public.contracts
FOR DELETE
USING (public.is_team_admin_or_moderator(auth.uid(), team_id));

-- Create storage bucket for contract files
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for contracts bucket
CREATE POLICY "Team members can view contract files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'contracts');

CREATE POLICY "Admins can upload contract files"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'contracts');

CREATE POLICY "Admins can delete contract files"
ON storage.objects
FOR DELETE
USING (bucket_id = 'contracts');

-- Trigger for updated_at
CREATE TRIGGER update_contracts_updated_at
BEFORE UPDATE ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();