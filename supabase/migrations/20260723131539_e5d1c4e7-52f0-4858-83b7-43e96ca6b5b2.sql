DROP POLICY IF EXISTS "Team members can read request attachments" ON storage.objects;
CREATE POLICY "Team members can read request attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'demand-attachments'
  AND EXISTS (
    SELECT 1
    FROM public.demand_request_attachments dra
    JOIN public.demand_requests dr ON dr.id = dra.demand_request_id
    JOIN public.team_members tm ON tm.team_id = dr.team_id
    WHERE dra.file_path = storage.objects.name
      AND tm.user_id = auth.uid()
  )
);