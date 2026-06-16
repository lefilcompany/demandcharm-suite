-- Allow system admins to manage plans (INSERT, UPDATE)
CREATE POLICY "Admins can insert plans"
ON public.plans FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update plans"
ON public.plans FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));