ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text;

-- WORK SCHEDULES
CREATE TABLE public.user_work_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weekday smallint NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_work_schedules_weekday_check CHECK (weekday >= 0 AND weekday <= 6),
  CONSTRAINT user_work_schedules_time_check CHECK (end_time > start_time),
  CONSTRAINT user_work_schedules_unique UNIQUE (team_id, user_id, weekday)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_work_schedules TO authenticated;
GRANT ALL ON public.user_work_schedules TO service_role;
ALTER TABLE public.user_work_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view work schedules"
ON public.user_work_schedules FOR SELECT TO authenticated
USING (public.is_team_member(auth.uid(), team_id));

CREATE POLICY "Users manage own work schedule"
ON public.user_work_schedules FOR ALL TO authenticated
USING (user_id = auth.uid() AND public.is_team_member(auth.uid(), team_id))
WITH CHECK (user_id = auth.uid() AND public.is_team_member(auth.uid(), team_id));

CREATE POLICY "Team admins manage work schedules"
ON public.user_work_schedules FOR ALL TO authenticated
USING (public.is_team_admin_or_moderator(auth.uid(), team_id))
WITH CHECK (public.is_team_admin_or_moderator(auth.uid(), team_id));

CREATE INDEX idx_user_work_schedules_team ON public.user_work_schedules(team_id);
CREATE INDEX idx_user_work_schedules_user ON public.user_work_schedules(user_id);
CREATE INDEX idx_user_work_schedules_team_user_weekday ON public.user_work_schedules(team_id, user_id, weekday);
CREATE INDEX idx_user_work_schedules_weekday ON public.user_work_schedules(weekday);

CREATE TRIGGER set_user_work_schedules_updated_at
BEFORE UPDATE ON public.user_work_schedules
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ABSENCES
CREATE TABLE public.user_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_absences_type_check CHECK (type IN ('vacation','day_off','leave','other')),
  CONSTRAINT user_absences_range_check CHECK (ends_on >= starts_on)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_absences TO authenticated;
GRANT ALL ON public.user_absences TO service_role;
ALTER TABLE public.user_absences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view absences"
ON public.user_absences FOR SELECT TO authenticated
USING (public.is_team_member(auth.uid(), team_id));

CREATE POLICY "Users manage own absences"
ON public.user_absences FOR ALL TO authenticated
USING (user_id = auth.uid() AND public.is_team_member(auth.uid(), team_id))
WITH CHECK (user_id = auth.uid() AND public.is_team_member(auth.uid(), team_id));

CREATE POLICY "Team admins manage absences"
ON public.user_absences FOR ALL TO authenticated
USING (public.is_team_admin_or_moderator(auth.uid(), team_id))
WITH CHECK (public.is_team_admin_or_moderator(auth.uid(), team_id));

CREATE INDEX idx_user_absences_team ON public.user_absences(team_id);
CREATE INDEX idx_user_absences_user ON public.user_absences(user_id);
CREATE INDEX idx_user_absences_range ON public.user_absences(team_id, starts_on, ends_on);
CREATE INDEX idx_user_absences_user_range ON public.user_absences(user_id, starts_on, ends_on);

CREATE TRIGGER set_user_absences_updated_at
BEFORE UPDATE ON public.user_absences
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- HOLIDAYS
CREATE TABLE public.team_holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  date date NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_holidays_unique UNIQUE (team_id, date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_holidays TO authenticated;
GRANT ALL ON public.team_holidays TO service_role;
ALTER TABLE public.team_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view holidays"
ON public.team_holidays FOR SELECT TO authenticated
USING (public.is_team_member(auth.uid(), team_id));

CREATE POLICY "Team admins manage holidays"
ON public.team_holidays FOR ALL TO authenticated
USING (public.is_team_admin_or_moderator(auth.uid(), team_id))
WITH CHECK (public.is_team_admin_or_moderator(auth.uid(), team_id));

CREATE INDEX idx_team_holidays_team ON public.team_holidays(team_id);
CREATE INDEX idx_team_holidays_date ON public.team_holidays(date);

CREATE TRIGGER set_team_holidays_updated_at
BEFORE UPDATE ON public.team_holidays
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();