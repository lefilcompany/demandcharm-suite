-- Fix storage policies with proper drops first

-- Drop existing demand-attachments policies (including any that might exist)
DROP POLICY IF EXISTS "Team members can view demand attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view attachments" ON storage.objects;

-- Make demand-attachments bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'demand-attachments';

-- Create proper team-scoped view policy for demand-attachments
CREATE POLICY "Team members can view demand attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'demand-attachments' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.demand_attachments da
    JOIN public.demands d ON d.id = da.demand_id
    JOIN public.team_members tm ON tm.team_id = d.team_id
    WHERE tm.user_id = auth.uid()
      AND da.file_path = storage.objects.name
  )
);

-- Fix contracts bucket policies
DROP POLICY IF EXISTS "Team members can view contract files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload contract files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete contract files" ON storage.objects;

-- Create properly scoped view policy using contracts table
CREATE POLICY "Team members can view contract files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'contracts'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.contracts c
    JOIN public.team_members tm ON tm.team_id = c.team_id
    WHERE tm.user_id = auth.uid()
      AND c.file_url LIKE '%' || storage.objects.name || '%'
  )
);

-- Create properly scoped upload policy (admins/moderators only)
CREATE POLICY "Admins can upload contract files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'contracts'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.team_id::text = (storage.foldername(name))[1]
      AND tm.role IN ('admin', 'moderator')
  )
);

-- Create properly scoped delete policy (admins/moderators only)
CREATE POLICY "Admins can delete contract files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'contracts'
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.team_id::text = (storage.foldername(name))[1]
      AND tm.role IN ('admin', 'moderator')
  )
);