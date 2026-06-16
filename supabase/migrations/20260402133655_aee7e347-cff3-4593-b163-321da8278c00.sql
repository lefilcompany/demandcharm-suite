-- Drop the overly broad upload policy for demand-attachments
DROP POLICY IF EXISTS "Team members can upload to demand-attachments" ON storage.objects;

-- Add scoped policy: users can only upload to their own folder
CREATE POLICY "Users upload to own folder in demand-attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'demand-attachments'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Add scoped policy: team members can upload request/comment attachments
CREATE POLICY "Team members can upload request attachments"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'demand-attachments'
  AND (
    (storage.foldername(name))[1] LIKE 'request-%'
    OR (storage.foldername(name))[1] LIKE 'comment-%'
  )
  AND EXISTS (
    SELECT 1 FROM team_members tm WHERE tm.user_id = auth.uid()
  )
);