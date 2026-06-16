
-- Fix demand_statuses RLS policies: correct parameter order and add UPDATE policy

-- Drop existing policies with inverted parameter order
DROP POLICY IF EXISTS "Board admins can create custom statuses for their board" ON demand_statuses;
DROP POLICY IF EXISTS "Board admins can delete custom statuses from their board" ON demand_statuses;

-- Recreate INSERT policy with correct parameter order
CREATE POLICY "Board admins can create custom statuses for their board" ON demand_statuses
  FOR INSERT TO authenticated
  WITH CHECK (board_id IS NOT NULL AND is_board_admin_or_moderator(auth.uid(), board_id));

-- Recreate DELETE policy with correct parameter order
CREATE POLICY "Board admins can delete custom statuses from their board" ON demand_statuses
  FOR DELETE TO authenticated
  USING (is_system = false AND board_id IS NOT NULL AND is_board_admin_or_moderator(auth.uid(), board_id));

-- Add new UPDATE policy for board admins/moderators
CREATE POLICY "Board admins can update custom statuses" ON demand_statuses
  FOR UPDATE TO authenticated
  USING (board_id IS NOT NULL AND is_board_admin_or_moderator(auth.uid(), board_id))
  WITH CHECK (board_id IS NOT NULL AND is_board_admin_or_moderator(auth.uid(), board_id));
