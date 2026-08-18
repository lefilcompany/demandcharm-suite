-- 1. platform_releases
CREATE TABLE public.platform_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_key text NOT NULL UNIQUE,
  deployment_id text,
  commit_sha text,
  source text NOT NULL DEFAULT 'lovable',
  status text NOT NULL DEFAULT 'detected',
  published_at timestamptz,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_releases_status_check CHECK (status IN ('detected','processing','completed','partial_failed','failed'))
);

GRANT SELECT ON public.platform_releases TO authenticated;
GRANT ALL ON public.platform_releases TO service_role;

ALTER TABLE public.platform_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global admins can read platform releases"
ON public.platform_releases FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_platform_releases_updated_at
BEFORE UPDATE ON public.platform_releases
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. release_features
CREATE TABLE public.release_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id uuid NOT NULL REFERENCES public.platform_releases(id) ON DELETE CASCADE,
  announcement_key text NOT NULL UNIQUE,
  feature_key text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  email_body text,
  cta_path text,
  cta_label text,
  priority text NOT NULL DEFAULT 'normal',
  audience_scope text NOT NULL DEFAULT 'global',
  global_roles text[],
  team_roles text[],
  board_roles text[],
  team_id uuid,
  board_id uuid,
  email_enabled boolean NOT NULL DEFAULT true,
  inapp_enabled boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending',
  processed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT release_features_priority_check CHECK (priority IN ('critical','high','normal','low')),
  CONSTRAINT release_features_audience_scope_check CHECK (audience_scope IN ('global','team','board')),
  CONSTRAINT release_features_status_check CHECK (status IN ('pending','processing','completed','partial_failed','skipped','failed'))
);

GRANT SELECT ON public.release_features TO authenticated;
GRANT ALL ON public.release_features TO service_role;

ALTER TABLE public.release_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Global admins can read release features"
ON public.release_features FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_release_features_release_id ON public.release_features(release_id);
CREATE INDEX idx_release_features_status ON public.release_features(status);

-- 3. platform_events
CREATE TABLE public.platform_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  last_error text,
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  CONSTRAINT platform_events_status_check CHECK (status IN ('pending','processing','processed','failed'))
);

GRANT ALL ON public.platform_events TO service_role;

ALTER TABLE public.platform_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_platform_events_status_next_retry ON public.platform_events(status, next_retry_at);
CREATE INDEX idx_platform_events_event_type ON public.platform_events(event_type);
CREATE INDEX idx_platform_events_aggregate_id ON public.platform_events(aggregate_id);

-- 4. release_deliveries
CREATE TABLE public.release_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  release_feature_id uuid NOT NULL REFERENCES public.release_features(id) ON DELETE CASCADE,
  announcement_key text NOT NULL,
  user_id uuid NOT NULL,
  channel text NOT NULL,
  priority text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_retry_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT release_deliveries_channel_check CHECK (channel IN ('email','inapp')),
  CONSTRAINT release_deliveries_priority_check CHECK (priority IN ('critical','high','normal','low')),
  CONSTRAINT release_deliveries_status_check CHECK (status IN ('pending','processing','sent','skipped','failed')),
  CONSTRAINT release_deliveries_unique_announcement_user_channel UNIQUE (announcement_key, user_id, channel)
);

GRANT ALL ON public.release_deliveries TO service_role;

ALTER TABLE public.release_deliveries ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_release_deliveries_feature ON public.release_deliveries(release_feature_id);
CREATE INDEX idx_release_deliveries_status_next_retry ON public.release_deliveries(status, next_retry_at);
CREATE INDEX idx_release_deliveries_user ON public.release_deliveries(user_id);

CREATE TRIGGER update_release_deliveries_updated_at
BEFORE UPDATE ON public.release_deliveries
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();