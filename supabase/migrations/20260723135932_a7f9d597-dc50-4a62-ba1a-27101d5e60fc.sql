UPDATE public.subscriptions
SET status = 'active',
    trial_ends_at = NULL,
    current_period_start = now(),
    current_period_end = '2099-12-31 23:59:59+00',
    cancel_at_period_end = false,
    plan_id = '2623e434-738b-48fe-8fad-854b22192f86',
    updated_at = now()
WHERE team_id = '64e5ff4e-a070-4b8d-8694-fd583c7a378b';