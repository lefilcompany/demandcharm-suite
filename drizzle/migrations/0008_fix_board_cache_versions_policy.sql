DROP POLICY IF EXISTS "Membros do quadro leem a versao" ON public.board_cache_versions;
CREATE POLICY "Membros do quadro leem a versao"
ON public.board_cache_versions
FOR SELECT
TO authenticated
USING (public.is_board_member(auth.uid(), board_id));