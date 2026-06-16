-- Create a public bucket for inline images in rich text editor
INSERT INTO storage.buckets (id, name, public)
VALUES ('inline-images', 'inline-images', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow authenticated users to upload to inline-images bucket
CREATE POLICY "Authenticated users can upload inline images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'inline-images');

-- Allow anyone to view inline images (since bucket is public)
CREATE POLICY "Anyone can view inline images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'inline-images');

-- Allow users to delete their own inline images
CREATE POLICY "Users can delete own inline images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'inline-images' AND auth.uid()::text = (storage.foldername(name))[1]);