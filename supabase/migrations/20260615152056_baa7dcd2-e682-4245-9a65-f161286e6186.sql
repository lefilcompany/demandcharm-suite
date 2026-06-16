DROP POLICY IF EXISTS "Team members can view team payments" ON public.payments;

CREATE POLICY "Team admins can view team payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.demand_requests dr
    WHERE dr.id = payments.demand_request_id
      AND public.is_team_admin_or_moderator(auth.uid(), dr.team_id)
  )
);