-- Allow anonymous users to view active plans (needed for public /get-started page)
CREATE POLICY "Anyone can view active plans"
ON public.plans
FOR SELECT
USING (is_active = true);
