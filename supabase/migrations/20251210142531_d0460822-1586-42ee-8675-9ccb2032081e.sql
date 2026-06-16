-- Permitir que admins adicionem membros à equipe
CREATE POLICY "Team admins can add members"
ON public.team_members
FOR INSERT
WITH CHECK (
  has_team_role(auth.uid(), team_id, 'admin'::team_role)
);