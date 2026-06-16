-- Remover política atual que exige admin global
DROP POLICY IF EXISTS "Admins can create teams" ON public.teams;

-- Criar nova política que permite qualquer usuário autenticado criar equipes
CREATE POLICY "Authenticated users can create teams" ON public.teams
FOR INSERT
WITH CHECK (auth.uid() = created_by);