-- Create the update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID REFERENCES public.demands(id) ON DELETE SET NULL,
  demand_request_id UUID REFERENCES public.demand_requests(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  amount_cents INTEGER NOT NULL,
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "Users can view their own payments"
ON public.payments
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own payments
CREATE POLICY "Users can create their own payments"
ON public.payments
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Team admins and moderators can view all team payments via demand_requests
CREATE POLICY "Team members can view team payments"
ON public.payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.demand_requests dr
    JOIN public.team_members tm ON tm.team_id = dr.team_id
    WHERE dr.id = payments.demand_request_id
    AND tm.user_id = auth.uid()
    AND tm.role IN ('admin', 'moderator')
  )
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_demand_request_id ON public.payments(demand_request_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- Add trigger for updated_at
CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();