-- Idempotent delivery tracking for scheduled notifications.
-- The service-role edge functions are the only writers; no client RLS policies
-- are intentionally created.

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  event_type text NOT NULL,
  demand_id uuid NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('in_app', 'email', 'push')),
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'sent', 'skipped', 'failed')),
  attempt_count integer NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
  last_error text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_deliveries_event_user_channel_key
    UNIQUE (event_key, user_id, channel)
);

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS notification_deliveries_demand_id_idx
  ON public.notification_deliveries (demand_id);

CREATE INDEX IF NOT EXISTS notification_deliveries_status_updated_at_idx
  ON public.notification_deliveries (status, updated_at);

COMMENT ON TABLE public.notification_deliveries IS
  'Idempotency and retry ledger for scheduled in-app, email and FCM notifications.';

CREATE OR REPLACE FUNCTION public.claim_notification_delivery(
  p_event_key text,
  p_event_type text,
  p_demand_id uuid,
  p_user_id uuid,
  p_channel text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_id uuid;
BEGIN
  IF p_channel NOT IN ('in_app', 'email', 'push') THEN
    RAISE EXCEPTION 'Unsupported notification channel: %', p_channel;
  END IF;

  INSERT INTO public.notification_deliveries (
    event_key,
    event_type,
    demand_id,
    user_id,
    channel,
    status,
    attempt_count,
    last_error,
    delivered_at,
    updated_at
  )
  VALUES (
    p_event_key,
    p_event_type,
    p_demand_id,
    p_user_id,
    p_channel,
    'processing',
    1,
    NULL,
    NULL,
    now()
  )
  ON CONFLICT (event_key, user_id, channel)
  DO UPDATE SET
    status = 'processing',
    attempt_count = public.notification_deliveries.attempt_count + 1,
    last_error = NULL,
    delivered_at = NULL,
    updated_at = now()
  WHERE
    public.notification_deliveries.attempt_count < 3
    AND (
      public.notification_deliveries.status = 'failed'
      OR (
        public.notification_deliveries.status = 'processing'
        AND public.notification_deliveries.updated_at < now() - interval '15 minutes'
      )
    )
  RETURNING id INTO claimed_id;

  RETURN claimed_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_delivery(text, text, uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_delivery(text, text, uuid, uuid, text)
  TO service_role;
