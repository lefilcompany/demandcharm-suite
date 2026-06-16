-- Add board_id column to demand_statuses for per-board custom statuses
ALTER TABLE demand_statuses ADD COLUMN board_id uuid REFERENCES boards(id) ON DELETE CASCADE;

-- Create index for faster lookups by board
CREATE INDEX idx_demand_statuses_board_id ON demand_statuses(board_id);

-- Update RLS policies to allow board admins to manage custom statuses
CREATE POLICY "Board admins can create custom statuses for their board"
ON demand_statuses
FOR INSERT
WITH CHECK (
  board_id IS NOT NULL 
  AND is_board_admin_or_moderator(board_id, auth.uid())
);

CREATE POLICY "Board admins can delete custom statuses from their board"
ON demand_statuses
FOR DELETE
USING (
  is_system = false 
  AND board_id IS NOT NULL 
  AND is_board_admin_or_moderator(board_id, auth.uid())
);

-- Clean up orphan custom statuses (statuses not linked to any board_statuses)
DELETE FROM demand_statuses 
WHERE is_system = false 
AND id NOT IN (SELECT DISTINCT status_id FROM board_statuses);