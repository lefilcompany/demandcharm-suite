DROP POLICY IF EXISTS "Anyone can view service catalog" ON public.service_catalog_items;
CREATE POLICY "Signed-in users can view service catalog" ON public.service_catalog_items FOR SELECT TO authenticated USING ((select auth.uid()) IS NOT NULL);
REVOKE SELECT ON public.service_catalog_items FROM anon;

DROP POLICY IF EXISTS "Authenticated users can upload inline images" ON storage.objects;
CREATE POLICY "Authenticated users can upload inline images" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'inline-images' AND (storage.foldername(name))[1] = (select auth.uid()::text));