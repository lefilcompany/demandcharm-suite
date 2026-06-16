-- Drop triggers if they exist (to avoid errors)
DROP TRIGGER IF EXISTS on_team_join_request_created ON team_join_requests;
DROP TRIGGER IF EXISTS on_team_join_request_responded ON team_join_requests;

-- Trigger to fire on new join request
CREATE TRIGGER on_team_join_request_created
  AFTER INSERT ON team_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_team_join_request_created();

-- Trigger to fire when join request status changes
CREATE TRIGGER on_team_join_request_responded
  AFTER UPDATE ON team_join_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_team_join_request_responded();