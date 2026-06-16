-- Criar função para verificar se código de acesso já existe (bypassa RLS)
CREATE OR REPLACE FUNCTION public.check_access_code_exists(code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM teams WHERE access_code = upper(code)
  );
END;
$$;