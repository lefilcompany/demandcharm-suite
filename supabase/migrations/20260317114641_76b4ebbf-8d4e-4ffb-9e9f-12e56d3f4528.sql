
-- Table: trial_coupons
CREATE TABLE public.trial_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  trial_days integer NOT NULL DEFAULT 15,
  max_uses integer NOT NULL DEFAULT 1,
  times_used integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  description text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.trial_coupons ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Admins can manage coupons" ON public.trial_coupons
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can validate active coupons
CREATE POLICY "Authenticated can validate coupons" ON public.trial_coupons
  FOR SELECT TO authenticated
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()) AND times_used < max_uses);

-- Table: coupon_redemptions
CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.trial_coupons(id),
  team_id uuid NOT NULL REFERENCES public.teams(id),
  redeemed_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(coupon_id, team_id)
);

ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all redemptions" ON public.coupon_redemptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Team members can view redemptions" ON public.coupon_redemptions
  FOR SELECT TO authenticated
  USING (public.is_team_member(auth.uid(), team_id));

-- RPC: redeem_trial_coupon
CREATE OR REPLACE FUNCTION public.redeem_trial_coupon(p_code text, p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_plan RECORD;
  v_user_id uuid;
  v_existing_sub uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  -- Find and lock coupon
  SELECT * INTO v_coupon FROM trial_coupons
  WHERE upper(trim(code)) = upper(trim(p_code))
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND times_used < max_uses
  FOR UPDATE;

  IF v_coupon IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_coupon');
  END IF;

  -- Check if team already redeemed this coupon
  IF EXISTS (SELECT 1 FROM coupon_redemptions WHERE coupon_id = v_coupon.id AND team_id = p_team_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_redeemed');
  END IF;

  -- Get the plan from the coupon
  SELECT * INTO v_plan FROM plans WHERE id = v_coupon.plan_id AND is_active = true;
  IF v_plan IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'plan_not_found');
  END IF;

  -- Increment usage
  UPDATE trial_coupons SET times_used = times_used + 1 WHERE id = v_coupon.id;

  -- Record redemption
  INSERT INTO coupon_redemptions (coupon_id, team_id, redeemed_by)
  VALUES (v_coupon.id, p_team_id, v_user_id);

  -- Check if subscription already exists for this team
  SELECT id INTO v_existing_sub FROM subscriptions WHERE team_id = p_team_id LIMIT 1;

  IF v_existing_sub IS NOT NULL THEN
    UPDATE subscriptions SET
      plan_id = v_plan.id,
      status = 'trialing',
      trial_ends_at = now() + (v_coupon.trial_days || ' days')::interval,
      current_period_start = now(),
      current_period_end = now() + (v_coupon.trial_days || ' days')::interval,
      updated_at = now()
    WHERE id = v_existing_sub;
  ELSE
    INSERT INTO subscriptions (team_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
    VALUES (p_team_id, v_plan.id, 'trialing', now() + (v_coupon.trial_days || ' days')::interval, now(), now() + (v_coupon.trial_days || ' days')::interval);
  END IF;

  RETURN jsonb_build_object('success', true, 'trial_days', v_coupon.trial_days, 'plan_name', v_plan.name);
END;
$$;

-- Admin RLS policies for viewing all data
CREATE POLICY "Admins can view all teams" ON public.teams
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all team members" ON public.team_members
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
