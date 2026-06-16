-- Add trial expiration column to profiles
ALTER TABLE profiles 
ADD COLUMN trial_ends_at timestamptz DEFAULT (now() + interval '3 months');

-- Update existing profiles to have trial based on their creation date
UPDATE profiles 
SET trial_ends_at = created_at + interval '3 months'
WHERE trial_ends_at IS NULL;