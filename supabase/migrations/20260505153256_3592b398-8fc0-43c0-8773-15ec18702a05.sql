-- Profile visibility preferences and banner gradient
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_visibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS banner_gradient text;