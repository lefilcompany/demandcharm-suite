CREATE TABLE public.fcm_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  device_id text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fcm_tokens_token_key UNIQUE (token),
  CONSTRAINT fcm_tokens_user_device_key UNIQUE (user_id, device_id)
);

CREATE INDEX fcm_tokens_user_id_idx ON public.fcm_tokens(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fcm_tokens TO authenticated;
GRANT ALL ON public.fcm_tokens TO service_role;

ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fcm_tokens_select_own" ON public.fcm_tokens
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "fcm_tokens_insert_own" ON public.fcm_tokens
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fcm_tokens_update_own" ON public.fcm_tokens
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fcm_tokens_delete_own" ON public.fcm_tokens
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.set_fcm_tokens_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_fcm_tokens_set_updated_at
  BEFORE UPDATE ON public.fcm_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_fcm_tokens_updated_at();

CREATE OR REPLACE FUNCTION public.register_fcm_token(
  p_token text,
  p_device_id text,
  p_user_agent text
)
RETURNS public.fcm_tokens
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row public.fcm_tokens;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_token IS NULL OR length(p_token) = 0 THEN
    RAISE EXCEPTION 'token is required' USING ERRCODE = '22023';
  END IF;

  IF p_device_id IS NULL OR length(p_device_id) = 0 THEN
    RAISE EXCEPTION 'device_id is required' USING ERRCODE = '22023';
  END IF;

  -- Remove any prior binding of the same token (possibly under another account/device)
  DELETE FROM public.fcm_tokens WHERE token = p_token;

  -- Remove prior token for this user+device (rotation)
  DELETE FROM public.fcm_tokens
   WHERE user_id = v_user_id AND device_id = p_device_id;

  INSERT INTO public.fcm_tokens (user_id, token, device_id, user_agent, last_used_at)
  VALUES (v_user_id, p_token, p_device_id, p_user_agent, now())
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.register_fcm_token(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.register_fcm_token(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.register_fcm_token(text, text, text) TO authenticated;