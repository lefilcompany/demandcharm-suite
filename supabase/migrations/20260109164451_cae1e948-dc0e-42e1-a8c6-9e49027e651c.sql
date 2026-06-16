-- Add explicit UPDATE and DELETE deny policies to payments table
-- This makes security intentions explicit: payment records are immutable after creation
-- Status updates happen only via service role (Stripe webhooks which bypass RLS)

-- Explicit deny for client-side updates
CREATE POLICY "Payments cannot be updated by users"
ON public.payments
FOR UPDATE
USING (false);

-- Explicit deny for client-side deletes
CREATE POLICY "Payments cannot be deleted by users"
ON public.payments
FOR DELETE
USING (false);