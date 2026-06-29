
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_demands_archived_updated ON public.demands (updated_at DESC) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_demands_status_id ON public.demands (status_id);
CREATE INDEX IF NOT EXISTS idx_demands_service_id ON public.demands (service_id);
CREATE INDEX IF NOT EXISTS idx_demands_assigned_to ON public.demands (assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_demands_created_by ON public.demands (created_by);
CREATE INDEX IF NOT EXISTS idx_demand_assignees_user ON public.demand_assignees (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles (email);
