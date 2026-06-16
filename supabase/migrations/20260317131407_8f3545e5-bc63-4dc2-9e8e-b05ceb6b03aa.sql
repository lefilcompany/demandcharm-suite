
-- Add currency and promotional pricing columns to plans
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL';
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price_cents_monthly integer NOT NULL DEFAULT 0;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS price_cents_yearly integer NOT NULL DEFAULT 0;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS promo_price_cents_monthly integer DEFAULT NULL;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS promo_price_cents_yearly integer DEFAULT NULL;

-- Migrate existing price_cents to monthly pricing
UPDATE public.plans SET price_cents_monthly = price_cents WHERE billing_period = 'monthly';
UPDATE public.plans SET price_cents_yearly = price_cents WHERE billing_period = 'yearly';
