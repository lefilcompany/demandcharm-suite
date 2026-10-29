ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS finance_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS integration_key uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS unit_external_id text;
CREATE UNIQUE INDEX IF NOT EXISTS projects_integration_key_uq ON public.projects(integration_key);

CREATE TABLE public.project_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  valid_from date NOT NULL DEFAULT date_trunc('month', now())::date,
  valid_to date,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE UNIQUE INDEX project_boards_active_uq ON public.project_boards(project_id, board_id) WHERE valid_to IS NULL;
CREATE INDEX project_boards_board ON public.project_boards(board_id);
CREATE INDEX project_boards_team ON public.project_boards(team_id);

CREATE TABLE public.finance_demand_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  demand_id uuid NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  competence date NOT NULL CHECK (extract(day from competence) = 1),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('auto','manual','pending')),
  reason text,
  decided_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (demand_id, competence),
  CHECK ((status = 'pending') = (project_id IS NULL))
);
CREATE INDEX fda_team_comp ON public.finance_demand_attributions(team_id, competence, status);
CREATE INDEX fda_project ON public.finance_demand_attributions(project_id);

CREATE TABLE public.finance_member_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('internal','client_external','contractor')),
  valid_from date NOT NULL DEFAULT date_trunc('month', now())::date,
  valid_to date,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
CREATE INDEX fmp_lookup ON public.finance_member_profiles(team_id, user_id, valid_from);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_boards TO authenticated;
GRANT SELECT ON public.finance_demand_attributions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_member_profiles TO authenticated;
GRANT ALL ON public.project_boards, public.finance_demand_attributions, public.finance_member_profiles TO service_role;

ALTER TABLE public.project_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_demand_attributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_member_profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_finance_structure(_user_id uuid, _team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_finance_permission(_user_id, 'finance.view_team', _team_id, NULL)
      OR public.has_finance_permission(_user_id, 'finance.manage_settings', _team_id, NULL)
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_finance_structure(uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.can_read_finance_structure(uuid, uuid) TO authenticated, service_role;

CREATE POLICY "pb_select" ON public.project_boards FOR SELECT TO authenticated
  USING (public.is_team_member((select auth.uid()), team_id) OR public.has_role((select auth.uid()), 'admin'));
CREATE POLICY "pb_write" ON public.project_boards FOR ALL TO authenticated
  USING (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL))
  WITH CHECK (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL));

CREATE POLICY "fda_select" ON public.finance_demand_attributions FOR SELECT TO authenticated
  USING (public.can_read_finance_structure((select auth.uid()), team_id));

CREATE POLICY "fmp_select" ON public.finance_member_profiles FOR SELECT TO authenticated
  USING (public.can_read_finance_structure((select auth.uid()), team_id));
CREATE POLICY "fmp_write" ON public.finance_member_profiles FOR ALL TO authenticated
  USING (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL))
  WITH CHECK (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL));

-- Validation: same team, no overlapping periods
CREATE OR REPLACE FUNCTION public.validate_project_board()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pt uuid; _bt uuid;
BEGIN
  SELECT team_id INTO _pt FROM public.projects WHERE id = NEW.project_id;
  SELECT team_id INTO _bt FROM public.boards WHERE id = NEW.board_id;
  IF _pt IS NULL OR _bt IS NULL OR _pt <> _bt THEN RAISE EXCEPTION 'PROJECT_BOARD_TEAM_MISMATCH'; END IF;
  NEW.team_id := _pt;
  NEW.updated_at := now();
  IF EXISTS (SELECT 1 FROM public.project_boards pb WHERE pb.project_id = NEW.project_id AND pb.board_id = NEW.board_id AND pb.id <> NEW.id
      AND daterange(pb.valid_from, COALESCE(pb.valid_to, 'infinity'::date), '[]') && daterange(NEW.valid_from, COALESCE(NEW.valid_to, 'infinity'::date), '[]')) THEN
    RAISE EXCEPTION 'PROJECT_BOARD_OVERLAP';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_project_board BEFORE INSERT OR UPDATE ON public.project_boards FOR EACH ROW EXECUTE FUNCTION public.validate_project_board();

CREATE OR REPLACE FUNCTION public.validate_member_profile()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF EXISTS (SELECT 1 FROM public.finance_member_profiles m WHERE m.team_id = NEW.team_id AND m.user_id = NEW.user_id AND m.id <> NEW.id
      AND daterange(m.valid_from, COALESCE(m.valid_to, 'infinity'::date), '[]') && daterange(NEW.valid_from, COALESCE(NEW.valid_to, 'infinity'::date), '[]')) THEN
    RAISE EXCEPTION 'MEMBER_PROFILE_OVERLAP';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_member_profile BEFORE INSERT OR UPDATE ON public.finance_member_profiles FOR EACH ROW EXECUTE FUNCTION public.validate_member_profile();

CREATE TRIGGER trg_finance_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_member_profiles FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();
CREATE TRIGGER trg_finance_audit AFTER INSERT OR UPDATE OR DELETE ON public.project_boards FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();
CREATE TRIGGER trg_finance_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_demand_attributions FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();

-- Automatic attribution
CREATE OR REPLACE FUNCTION public.finance_auto_attribute_demand(_demand_id uuid, _competence date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _board uuid; _team uuid; _cnt int; _proj uuid; _comp date := date_trunc('month', _competence)::date;
BEGIN
  SELECT d.board_id, b.team_id INTO _board, _team FROM public.demands d JOIN public.boards b ON b.id = d.board_id WHERE d.id = _demand_id;
  IF _team IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.finance_demand_attributions WHERE demand_id = _demand_id AND competence = _comp AND status = 'manual') THEN RETURN; END IF;
  SELECT count(DISTINCT pb.project_id), min(pb.project_id::text)::uuid INTO _cnt, _proj
  FROM public.project_boards pb JOIN public.projects p ON p.id = pb.project_id AND p.finance_enabled
  WHERE pb.board_id = _board AND pb.valid_from <= (_comp + interval '1 month' - interval '1 day')::date
    AND (pb.valid_to IS NULL OR pb.valid_to >= _comp);
  INSERT INTO public.finance_demand_attributions(team_id, demand_id, competence, project_id, status, reason)
  VALUES (_team, _demand_id, _comp, CASE WHEN _cnt = 1 THEN _proj END, CASE WHEN _cnt = 1 THEN 'auto' ELSE 'pending' END,
          CASE WHEN _cnt = 0 THEN 'NO_PROJECT' WHEN _cnt > 1 THEN 'MULTIPLE_PROJECTS' END)
  ON CONFLICT (demand_id, competence) DO UPDATE SET project_id = EXCLUDED.project_id, status = EXCLUDED.status, reason = EXCLUDED.reason, team_id = EXCLUDED.team_id, updated_at = now()
  WHERE public.finance_demand_attributions.status <> 'manual';
END $$;
REVOKE EXECUTE ON FUNCTION public.finance_auto_attribute_demand(uuid, date) FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.finance_auto_attribute_demand(uuid, date) TO service_role;

CREATE OR REPLACE FUNCTION public.trg_demand_finance_attribution()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.board_id IS DISTINCT FROM OLD.board_id THEN
    PERFORM public.finance_auto_attribute_demand(NEW.id, now()::date);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_demand_finance_attribution AFTER INSERT OR UPDATE OF board_id ON public.demands FOR EACH ROW EXECUTE FUNCTION public.trg_demand_finance_attribution();

-- Re-evaluate board demands when links change
CREATE OR REPLACE FUNCTION public.trg_project_board_reattribute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d record; _board uuid := COALESCE(NEW.board_id, OLD.board_id);
BEGIN
  FOR _d IN SELECT id FROM public.demands WHERE board_id = _board AND COALESCE(archived, false) = false LOOP
    PERFORM public.finance_auto_attribute_demand(_d.id, now()::date);
  END LOOP;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_project_board_reattribute AFTER INSERT OR UPDATE OR DELETE ON public.project_boards FOR EACH ROW EXECUTE FUNCTION public.trg_project_board_reattribute();

CREATE OR REPLACE FUNCTION public.trg_project_finance_toggle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _d record;
BEGIN
  IF NEW.finance_enabled IS DISTINCT FROM OLD.finance_enabled THEN
    FOR _d IN SELECT d.id FROM public.demands d JOIN public.project_boards pb ON pb.board_id = d.board_id AND pb.project_id = NEW.id
              WHERE COALESCE(d.archived, false) = false LOOP
      PERFORM public.finance_auto_attribute_demand(_d.id, now()::date);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_project_finance_toggle AFTER UPDATE OF finance_enabled ON public.projects FOR EACH ROW EXECUTE FUNCTION public.trg_project_finance_toggle();

-- Manual assignment
CREATE OR REPLACE FUNCTION public.finance_assign_demand(_demand_id uuid, _competence date, _project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _team uuid; _pteam uuid; _comp date := date_trunc('month', _competence)::date;
BEGIN
  SELECT b.team_id INTO _team FROM public.demands d JOIN public.boards b ON b.id = d.board_id WHERE d.id = _demand_id;
  IF _team IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT public.has_finance_permission(auth.uid(), 'finance.manage_settings', _team, NULL) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  SELECT team_id INTO _pteam FROM public.projects WHERE id = _project_id AND finance_enabled;
  IF _pteam IS NULL OR _pteam <> _team THEN RAISE EXCEPTION 'INVALID_PROJECT'; END IF;
  IF EXISTS (SELECT 1 FROM public.finance_periods fp WHERE fp.team_id = _team AND fp.competence = _comp AND fp.closed_at IS NOT NULL) THEN RAISE EXCEPTION 'PERIOD_CLOSED'; END IF;
  INSERT INTO public.finance_demand_attributions(team_id, demand_id, competence, project_id, status, decided_by)
  VALUES (_team, _demand_id, _comp, _project_id, 'manual', auth.uid())
  ON CONFLICT (demand_id, competence) DO UPDATE SET project_id = EXCLUDED.project_id, status = 'manual', reason = NULL, decided_by = auth.uid(), updated_at = now();
END $$;
REVOKE EXECUTE ON FUNCTION public.finance_assign_demand(uuid, date, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.finance_assign_demand(uuid, date, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.finance_pending_demands(_team_id uuid, _competence date)
RETURNS TABLE(demand_id uuid, title text, board_id uuid, board_name text, reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_read_finance_structure(auth.uid(), _team_id) THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY SELECT a.demand_id, d.title, d.board_id, b.name, a.reason
  FROM public.finance_demand_attributions a JOIN public.demands d ON d.id = a.demand_id JOIN public.boards b ON b.id = d.board_id
  WHERE a.team_id = _team_id AND a.competence = date_trunc('month', _competence)::date AND a.status = 'pending'
  ORDER BY b.name, d.title;
END $$;
REVOKE EXECUTE ON FUNCTION public.finance_pending_demands(uuid, date) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.finance_pending_demands(uuid, date) TO authenticated;
