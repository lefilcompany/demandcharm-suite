
-- Add hashed columns
ALTER TABLE public.webhook_subscriptions
  ADD COLUMN IF NOT EXISTS secret_hash text,
  ADD COLUMN IF NOT EXISTS secret_prefix text;

-- Migrate existing data: hash secrets and store prefix
UPDATE public.webhook_subscriptions
SET secret_hash = encode(sha256(secret::bytea), 'hex'),
    secret_prefix = left(secret, 8)
WHERE secret IS NOT NULL AND secret_hash IS NULL;

-- Make new columns required
ALTER TABLE public.webhook_subscriptions
  ALTER COLUMN secret_hash SET NOT NULL,
  ALTER COLUMN secret_prefix SET NOT NULL;

-- Drop the plaintext secret column
ALTER TABLE public.webhook_subscriptions DROP COLUMN IF EXISTS secret;
