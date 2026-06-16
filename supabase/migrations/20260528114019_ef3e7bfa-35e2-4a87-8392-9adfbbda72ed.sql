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
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE team_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  -- Pick the Starter plan as the trial plan.
  SELECT id INTO v_plan_id
  FROM public.plans
  WHERE slug = 'starter' AND is_active = true
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    SELECT id INTO v_plan_id
    FROM public.plans
    WHERE is_active = true
    ORDER BY sort_order ASC
    LIMIT 1;
  END IF;

  IF v_plan_id IS NULL THEN
    RETURN NEW;
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