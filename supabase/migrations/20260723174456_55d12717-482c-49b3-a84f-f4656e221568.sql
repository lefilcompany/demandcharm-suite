-- Alinha RLS de demand_requests com a regra de negócio: admins/coordenadores do quadro aprovam.
DROP POLICY IF EXISTS "Admins and moderators can update team requests" ON public.demand_requests;
DROP POLICY IF EXISTS "Admins and moderators can view team requests"   ON public.demand_requests;

CREATE POLICY "Board approvers can view requests"
  ON public.demand_requests FOR SELECT
  USING (
    public.is_team_admin_or_moderator(auth.uid(), team_id)
    OR (board_id IS NOT NULL AND public.is_board_admin_or_moderator(auth.uid(), board_id))
  );

CREATE POLICY "Board approvers can update requests"
  ON public.demand_requests FOR UPDATE
  USING (
    public.is_team_admin_or_moderator(auth.uid(), team_id)
    OR (board_id IS NOT NULL AND public.is_board_admin_or_moderator(auth.uid(), board_id))
  );
