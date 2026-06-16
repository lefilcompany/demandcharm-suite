-- Trigger function to auto-create a 3-day trial subscription on team creation
CREATE OR REPLACE FUNCTION public.create_trial_subscription_for_team()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
  v_trial_ends timestamptz;
BEGIN
  -- Skip if a subscription already exists for this team (e.g. created via coupon)
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE team_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Pick the Business plan as the trial plan (full feature access).
  -- Fallback to highest-sort active plan if 'business' is missing.
  SELECT id INTO v_plan_id
  FROM public.plans
  WHERE slug = 'business' AND is_active = true
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id
    FROM public.plans
    WHERE is_active = true
    ORDER BY sort_order DESC
    LIMIT 1;
  END IF;

  IF v_plan_id IS NULL THEN
    RETURN NEW; -- no plan available, skip silently
  END IF;

  v_trial_ends := now() + interval '3 days';

  INSERT INTO public.subscriptions (
    team_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    trial_ends_at
  ) VALUES (
    NEW.id,
    v_plan_id,
    'trialing',
    now(),
    v_trial_ends,
    v_trial_ends
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_trial_subscription ON public.teams;
CREATE TRIGGER trg_create_trial_subscription
AFTER INSERT ON public.teams
FOR EACH ROW
EXECUTE FUNCTION public.create_trial_subscription_for_team();