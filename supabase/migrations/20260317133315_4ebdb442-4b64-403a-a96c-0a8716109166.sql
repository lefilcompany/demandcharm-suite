
CREATE OR REPLACE FUNCTION public.update_trial_coupon(
  p_coupon_id uuid,
  p_plan_id uuid,
  p_trial_days integer,
  p_max_uses integer,
  p_description text DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL,
  p_propagate boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_coupon RECORD;
  v_affected_teams integer := 0;
  v_redemption RECORD;
BEGIN
  -- Validate admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  -- Get current coupon
  SELECT * INTO v_coupon FROM trial_coupons WHERE id = p_coupon_id;
  IF v_coupon IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'coupon_not_found');
  END IF;

  -- Update the coupon
  UPDATE trial_coupons SET
    plan_id = p_plan_id,
    trial_days = p_trial_days,
    max_uses = p_max_uses,
    description = p_description,
    expires_at = p_expires_at
  WHERE id = p_coupon_id;

  -- Propagate changes to existing redemptions if requested
  IF p_propagate THEN
    FOR v_redemption IN
      SELECT cr.team_id FROM coupon_redemptions cr WHERE cr.coupon_id = p_coupon_id
    LOOP
      -- Update subscription plan and trial period for teams that redeemed this coupon
      UPDATE subscriptions SET
        plan_id = p_plan_id,
        trial_ends_at = created_at + (p_trial_days || ' days')::interval,
        current_period_end = created_at + (p_trial_days || ' days')::interval,
        updated_at = now()
      WHERE team_id = v_redemption.team_id
        AND status = 'trialing';
      
      IF FOUND THEN
        v_affected_teams := v_affected_teams + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'affected_teams', v_affected_teams);
END;
$$;
