-- Política para permitir leitura de anexos de solicitações
-- Permite que qualquer usuário autenticado possa ler arquivos de requests
-- Isso é necessário para que admins, moderadores e executores possam ver os anexos
CREATE POLICY "Allow authenticated users to read request attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'demand-attachments' 
  AND (
    -- Permite ler anexos de requests (pasta começa com 'request-')
    name LIKE 'request-%'
    -- Ou permite ler anexos de demandas (estrutura atual)
    OR owner = (SELECT auth.uid())
  )
);

-- Política para permitir upload de anexos por usuários autenticados
CREATE POLICY "Allow authenticated users to upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'demand-attachments'
);

-- Política para permitir que usuários deletem seus próprios anexos
CREATE POLICY "Allow users to delete own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'demand-attachments'
  AND owner = (SELECT auth.uid())
);