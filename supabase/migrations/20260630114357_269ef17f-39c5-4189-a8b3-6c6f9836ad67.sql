
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id) WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_demands_board_archived_updated
  ON public.demands (board_id, archived, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_di_demand_type_created
  ON public.demand_interactions (demand_id, interaction_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dte_demand_created
  ON public.demand_time_entries (demand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dte_demand_started
  ON public.demand_time_entries (demand_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_board_members_board_joined
  ON public.board_members (board_id, joined_at ASC);

CREATE INDEX IF NOT EXISTS idx_demand_assignees_demand
  ON public.demand_assignees (demand_id);

ANALYZE public.notifications;
ANALYZE public.demands;
ANALYZE public.demand_interactions;
ANALYZE public.demand_time_entries;
ANALYZE public.board_members;
