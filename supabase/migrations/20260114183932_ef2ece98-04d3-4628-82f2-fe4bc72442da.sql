-- Add text_color column to team_positions for manual font color control
ALTER TABLE public.team_positions
ADD COLUMN text_color text DEFAULT 'auto';

-- Comment explaining the values
COMMENT ON COLUMN public.team_positions.text_color IS 'Font color preference: auto, light, or dark';