-- Drop overly permissive INSERT policies
DROP POLICY IF EXISTS "Allow authenticated users to upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Team members can upload attachments" ON storage.objects;

-- Create single INSERT policy that checks team membership
CREATE POLICY "Team members can upload to demand-attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'demand-attachments'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
  )
);

-- Drop overly permissive SELECT policy for request attachments
DROP POLICY IF EXISTS "Allow authenticated users to read request attachments" ON storage.objects;

-- Create restricted SELECT policy for request attachments that checks team membership
CREATE POLICY "Team members can read request attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'demand-attachments'
  AND name LIKE 'request-%'
  AND EXISTS (
    SELECT 1 FROM public.demand_request_attachments dra
    JOIN public.demand_requests dr ON dr.id = dra.demand_request_id
    JOIN public.team_members tm ON tm.team_id = dr.team_id
    WHERE tm.user_id = auth.uid()
    AND dra.file_path = name
  )
);