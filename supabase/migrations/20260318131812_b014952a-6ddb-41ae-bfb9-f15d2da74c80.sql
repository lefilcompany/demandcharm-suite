-- Fix foreign key constraints to CASCADE on delete for boards
ALTER TABLE demand_requests
  DROP CONSTRAINT IF EXISTS demand_requests_board_id_fkey;
ALTER TABLE demand_requests
  ADD CONSTRAINT demand_requests_board_id_fkey
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET NULL;

ALTER TABLE demand_templates
  DROP CONSTRAINT IF EXISTS demand_templates_board_id_fkey;
ALTER TABLE demand_templates
  ADD CONSTRAINT demand_templates_board_id_fkey
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;

ALTER TABLE services
  DROP CONSTRAINT IF EXISTS services_board_id_fkey;
ALTER TABLE services
  ADD CONSTRAINT services_board_id_fkey
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET NULL;

-- For demands, we need to delete them when board is deleted
ALTER TABLE demands
  DROP CONSTRAINT IF EXISTS demands_board_id_fkey;
ALTER TABLE demands
  ADD CONSTRAINT demands_board_id_fkey
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE;