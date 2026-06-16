
-- Tighten upload policy for request/comment attachments in demand-attachments bucket
DROP POLICY IF EXISTS "Team members can upload request attachments" ON storage.objects;

CREATE POLICY "Team members can upload request attachments"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'demand-attachments'
  AND (
    -- request-{requestId}/...
    (
      (storage.foldername(name))[1] LIKE 'request-%'
      AND EXISTS (
        SELECT 1
        FROM public.demand_requests dr
        JOIN public.team_members tm ON tm.team_id = dr.team_id
        WHERE tm.user_id = auth.uid()
          AND dr.id::text = substring((storage.foldername(name))[1] FROM 9)
      )
    )
    OR
    -- comment-{commentId}/...
    (
      (storage.foldername(name))[1] LIKE 'comment-%'
      AND EXISTS (
        SELECT 1
        FROM public.demand_request_comments c
        JOIN public.demand_requests dr ON dr.id = c.request_id
        JOIN public.team_members tm ON tm.team_id = dr.team_id
        WHERE tm.user_id = auth.uid()
          AND c.id::text = substring((storage.foldername(name))[1] FROM 9)
      )
    )
  )
);
