CREATE OR REPLACE FUNCTION public.redeem_trial_coupon(p_code text, p_team_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Auto-deactivate if limit reached after this redemption
  IF (v_coupon.times_used + 1) >= v_coupon.max_uses THEN
    UPDATE trial_coupons SET is_active = false WHERE id = v_coupon.id;
  END IF;

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

  -- Sync profile trial_ends_at for the redeeming user (fallback compatibility)
  UPDATE profiles
  SET trial_ends_at = now() + (v_coupon.trial_days || ' days')::interval,
      updated_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true, 'trial_days', v_coupon.trial_days, 'plan_name', v_plan.name);
END;
$function$;