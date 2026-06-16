-- Update the default trial period from 3 months to 10 days
ALTER TABLE public.profiles 
ALTER COLUMN trial_ends_at 
SET DEFAULT (now() + interval '10 days');
