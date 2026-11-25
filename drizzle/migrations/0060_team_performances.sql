CREATE TABLE public.team_performances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT '#F28705',
  text_color text NOT NULL DEFAULT 'auto',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  legacy_position_id uuid UNIQUE,
  UNIQUE (team_id, name)
);
CREATE INDEX idx_team_performances_team ON public.team_performances(team_id);

CREATE TABLE public.team_performance_members (
  performance_id uuid NOT NULL REFERENCES public.team_performances(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  added_by uuid,
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (performance_id, team_member_id)
);
CREATE INDEX idx_tpm_member ON public.team_performance_members(team_member_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_performances TO authenticated;
GRANT ALL ON public.team_performances TO service_role;
GRANT SELECT, INSERT, DELETE ON public.team_performance_members TO authenticated;
GRANT ALL ON public.team_performance_members TO service_role;

ALTER TABLE public.team_performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_performance_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members view performances" ON public.team_performances FOR SELECT TO authenticated
  USING (public.is_team_member((select auth.uid()), team_id));
CREATE POLICY "Team admin/moderator create performances" ON public.team_performances FOR INSERT TO authenticated
  WITH CHECK (public.is_team_admin_or_moderator((select auth.uid()), team_id));
CREATE POLICY "Team admin/moderator update performances" ON public.team_performances FOR UPDATE TO authenticated
  USING (public.is_team_admin_or_moderator((select auth.uid()), team_id))
  WITH CHECK (public.is_team_admin_or_moderator((select auth.uid()), team_id));
CREATE POLICY "Team admin delete performances" ON public.team_performances FOR DELETE TO authenticated
  USING (public.is_team_admin((select auth.uid()), team_id));

CREATE OR REPLACE FUNCTION public.performance_team_id(_performance_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT team_id FROM public.team_performances WHERE id = _performance_id
$$;
REVOKE EXECUTE ON FUNCTION public.performance_team_id(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.performance_team_id(uuid) TO authenticated, service_role;

CREATE POLICY "Team members view performance members" ON public.team_performance_members FOR SELECT TO authenticated
  USING (public.is_team_member((select auth.uid()), public.performance_team_id(performance_id)));
CREATE POLICY "Team admin/moderator add performance members" ON public.team_performance_members FOR INSERT TO authenticated
  WITH CHECK (public.is_team_admin_or_moderator((select auth.uid()), public.performance_team_id(performance_id)));
CREATE POLICY "Team admin/moderator remove performance members" ON public.team_performance_members FOR DELETE TO authenticated
  USING (public.is_team_admin_or_moderator((select auth.uid()), public.performance_team_id(performance_id)));

CREATE OR REPLACE FUNCTION public.guard_performance_member_internal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_team uuid; v_kind text; v_mteam uuid;
BEGIN
  SELECT team_id INTO v_team FROM public.team_performances WHERE id = NEW.performance_id;
  SELECT team_id, member_kind INTO v_mteam, v_kind FROM public.team_members WHERE id = NEW.team_member_id;
  IF v_mteam IS NULL OR v_mteam <> v_team THEN
    RAISE EXCEPTION 'PERFORMANCE_MEMBER_OTHER_TEAM' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(v_kind, 'internal') <> 'internal' THEN
    RAISE EXCEPTION 'PERFORMANCE_MEMBER_NOT_INTERNAL' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_guard_performance_member_internal BEFORE INSERT OR UPDATE ON public.team_performance_members
  FOR EACH ROW EXECUTE FUNCTION public.guard_performance_member_internal();

CREATE OR REPLACE FUNCTION public.drop_performances_when_not_internal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF COALESCE(NEW.member_kind, 'internal') <> 'internal' THEN
    DELETE FROM public.team_performance_members WHERE team_member_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_drop_performances_when_not_internal AFTER UPDATE OF member_kind ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.drop_performances_when_not_internal();

INSERT INTO public.team_performances (team_id, name, description, color, text_color, created_by, created_at, legacy_position_id)
SELECT team_id, name, description, color, COALESCE(text_color, 'auto'), created_by, created_at, id FROM public.team_positions
ON CONFLICT DO NOTHING;

INSERT INTO public.team_performance_members (performance_id, team_member_id, added_at)
SELECT p.id, tm.id, now()
FROM public.team_members tm JOIN public.team_performances p ON p.legacy_position_id = tm.position_id
WHERE COALESCE(tm.member_kind, 'internal') = 'internal'
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.team_positions IS 'DEPRECATED: replaced by team_performances';
COMMENT ON COLUMN public.team_members.position_id IS 'DEPRECATED: replaced by team_performance_members';