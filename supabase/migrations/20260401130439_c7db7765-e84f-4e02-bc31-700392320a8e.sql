ALTER TABLE recurring_demands DROP CONSTRAINT IF EXISTS recurring_demands_frequency_check;
ALTER TABLE recurring_demands ADD CONSTRAINT recurring_demands_frequency_check 
  CHECK (frequency = ANY (ARRAY['daily', 'weekly', 'biweekly', 'monthly', 'test_1min', 'test_5min']));