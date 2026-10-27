CREATE TABLE public.finance_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  board_id uuid REFERENCES public.boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  permission text NOT NULL CHECK (permission IN ('finance.view_team','finance.view_board','finance.view_project','finance.view_cost_details','finance.view_employee_costs','finance.manage_revenue','finance.manage_expenses','finance.manage_allocations','finance.manage_settings','finance.export')),
  granted_by uuid NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid,
  revoked_at timestamptz
);
CREATE INDEX finance_permissions_lookup ON public.finance_permissions(user_id, team_id, permission) WHERE revoked_at IS NULL;

CREATE TABLE public.finance_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  board_id uuid REFERENCES public.boards(id) ON DELETE CASCADE,
  tax_rate numeric NOT NULL DEFAULT 0.21 CHECK (tax_rate >= 0 AND tax_rate < 1),
  margin_target numeric NOT NULL DEFAULT 0.40 CHECK (margin_target > -1 AND margin_target < 1),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (team_id, board_id)
);

CREATE TABLE public.finance_employee_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  competence date NOT NULL,
  monthly_cost numeric NOT NULL CHECK (monthly_cost >= 0),
  productive_hours numeric NOT NULL DEFAULT 140 CHECK (productive_hours > 0),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id, competence)
);

CREATE TABLE public.finance_revenues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  competence date NOT NULL,
  gross_amount numeric NOT NULL CHECK (gross_amount >= 0),
  tax_rate numeric CHECK (tax_rate IS NULL OR (tax_rate >= 0 AND tax_rate < 1)),
  description text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX finance_revenues_scope ON public.finance_revenues(team_id, board_id, competence);

CREATE TABLE public.finance_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  competence date NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'direct',
  amount numeric NOT NULL CHECK (amount >= 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX finance_expenses_scope ON public.finance_expenses(team_id, board_id, competence);

CREATE TABLE public.finance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX finance_audit_team ON public.finance_audit_log(team_id, created_at DESC);

GRANT SELECT ON public.finance_permissions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.finance_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_employee_costs, public.finance_revenues, public.finance_expenses TO authenticated;
GRANT SELECT ON public.finance_audit_log TO authenticated;
GRANT ALL ON public.finance_permissions, public.finance_settings, public.finance_employee_costs, public.finance_revenues, public.finance_expenses, public.finance_audit_log TO service_role;

ALTER TABLE public.finance_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_employee_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_revenues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_audit_log ENABLE ROW LEVEL SECURITY;

-- Core check: global admin, or team member with an active grant. Team-scoped grants cover every board
-- of the team; board-scoped grants need a non-requester board membership. Requesters never pass for that board.
CREATE OR REPLACE FUNCTION public.has_finance_permission(_user_id uuid, _permission text, _team_id uuid, _board_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN false
    WHEN public.has_role(_user_id, 'admin') THEN true
    WHEN NOT public.is_team_member(_user_id, _team_id) THEN false
    WHEN _board_id IS NOT NULL AND (
      NOT EXISTS (SELECT 1 FROM public.boards b WHERE b.id = _board_id AND b.team_id = _team_id)
      OR EXISTS (SELECT 1 FROM public.board_members bm WHERE bm.board_id = _board_id AND bm.user_id = _user_id AND bm.role::text = 'requester')
    ) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.finance_permissions fp
      WHERE fp.user_id = _user_id AND fp.team_id = _team_id AND fp.permission = _permission AND fp.revoked_at IS NULL
        AND (
          fp.board_id IS NULL
          OR (_board_id IS NOT NULL AND fp.board_id = _board_id
              AND EXISTS (SELECT 1 FROM public.board_members bm WHERE bm.board_id = _board_id AND bm.user_id = _user_id))
        )
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.can_view_finance_board(_user_id uuid, _team_id uuid, _board_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_finance_permission(_user_id, 'finance.view_board', _team_id, _board_id)
      OR public.has_finance_permission(_user_id, 'finance.view_team', _team_id, _board_id)
$$;

REVOKE EXECUTE ON FUNCTION public.has_finance_permission(uuid, text, uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_view_finance_board(uuid, uuid, uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_finance_permission(uuid, text, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_view_finance_board(uuid, uuid, uuid) TO authenticated, service_role;

CREATE POLICY "fp_select" ON public.finance_permissions FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL));

CREATE POLICY "fs_select" ON public.finance_settings FOR SELECT TO authenticated
  USING (public.has_finance_permission((select auth.uid()), 'finance.view_team', team_id, NULL)
      OR (board_id IS NULL AND EXISTS (SELECT 1 FROM public.finance_permissions fp WHERE fp.user_id = (select auth.uid()) AND fp.team_id = finance_settings.team_id AND fp.revoked_at IS NULL))
      OR (board_id IS NOT NULL AND public.can_view_finance_board((select auth.uid()), team_id, board_id)));
CREATE POLICY "fs_insert" ON public.finance_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL));
CREATE POLICY "fs_update" ON public.finance_settings FOR UPDATE TO authenticated
  USING (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL))
  WITH CHECK (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL));

CREATE POLICY "fec_select" ON public.finance_employee_costs FOR SELECT TO authenticated
  USING (public.has_finance_permission((select auth.uid()), 'finance.view_employee_costs', team_id, NULL));
CREATE POLICY "fec_write" ON public.finance_employee_costs FOR ALL TO authenticated
  USING (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL))
  WITH CHECK (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL));

CREATE POLICY "fr_select" ON public.finance_revenues FOR SELECT TO authenticated
  USING (public.can_view_finance_board((select auth.uid()), team_id, board_id));
CREATE POLICY "fr_write" ON public.finance_revenues FOR ALL TO authenticated
  USING (public.has_finance_permission((select auth.uid()), 'finance.manage_revenue', team_id, board_id))
  WITH CHECK (public.has_finance_permission((select auth.uid()), 'finance.manage_revenue', team_id, board_id));

CREATE POLICY "fx_select" ON public.finance_expenses FOR SELECT TO authenticated
  USING (public.can_view_finance_board((select auth.uid()), team_id, board_id));
CREATE POLICY "fx_write" ON public.finance_expenses FOR ALL TO authenticated
  USING (public.has_finance_permission((select auth.uid()), 'finance.manage_expenses', team_id, board_id))
  WITH CHECK (public.has_finance_permission((select auth.uid()), 'finance.manage_expenses', team_id, board_id));

CREATE POLICY "fa_select" ON public.finance_audit_log FOR SELECT TO authenticated
  USING (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL));

-- Audit trigger
CREATE OR REPLACE FUNCTION public.finance_audit_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','INSERT') THEN NEW.updated_at := COALESCE(NEW.updated_at, now()); END IF;
  INSERT INTO public.finance_audit_log(team_id, actor_id, action, entity, entity_id, before_data, after_data)
  VALUES (COALESCE(NEW.team_id, OLD.team_id), auth.uid(), lower(TG_OP), TG_TABLE_NAME, COALESCE(NEW.id, OLD.id),
          CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
          CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_finance_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_employee_costs FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();
CREATE TRIGGER trg_finance_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_revenues FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();
CREATE TRIGGER trg_finance_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_expenses FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();
CREATE TRIGGER trg_finance_audit AFTER INSERT OR UPDATE OR DELETE ON public.finance_settings FOR EACH ROW EXECUTE FUNCTION public.finance_audit_trigger();

-- Grant / revoke only through RPCs
CREATE OR REPLACE FUNCTION public.grant_finance_permission(_team_id uuid, _user_id uuid, _permission text, _board_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _id uuid; _is_admin boolean;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED'; END IF;
  _is_admin := public.has_role(_me, 'admin');
  IF NOT _is_admin THEN
    IF _me = _user_id THEN RAISE EXCEPTION 'CANNOT_GRANT_SELF'; END IF;
    IF NOT (public.is_team_admin(_me, _team_id) AND public.has_finance_permission(_me, 'finance.manage_settings', _team_id, NULL)) THEN
      RAISE EXCEPTION 'FORBIDDEN';
    END IF;
  END IF;
  IF NOT public.is_team_member(_user_id, _team_id) THEN RAISE EXCEPTION 'USER_NOT_IN_TEAM'; END IF;
  IF _board_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.board_members WHERE board_id = _board_id AND user_id = _user_id AND role::text <> 'requester') THEN
    RAISE EXCEPTION 'USER_NOT_ON_BOARD';
  END IF;
  SELECT id INTO _id FROM public.finance_permissions WHERE team_id = _team_id AND user_id = _user_id AND permission = _permission
    AND board_id IS NOT DISTINCT FROM _board_id AND revoked_at IS NULL;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  INSERT INTO public.finance_permissions(team_id, board_id, user_id, permission, granted_by)
  VALUES (_team_id, _board_id, _user_id, _permission, _me) RETURNING id INTO _id;
  INSERT INTO public.finance_audit_log(team_id, actor_id, action, entity, entity_id, after_data)
  VALUES (_team_id, _me, 'grant', 'finance_permissions', _id, jsonb_build_object('user_id', _user_id, 'permission', _permission, 'board_id', _board_id));
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_finance_permission(_permission_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _row public.finance_permissions;
BEGIN
  SELECT * INTO _row FROM public.finance_permissions WHERE id = _permission_id AND revoked_at IS NULL;
  IF _row.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF NOT public.has_role(_me, 'admin') AND NOT (public.is_team_admin(_me, _row.team_id) AND public.has_finance_permission(_me, 'finance.manage_settings', _row.team_id, NULL)) THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  UPDATE public.finance_permissions SET revoked_at = now(), revoked_by = _me WHERE id = _permission_id;
  INSERT INTO public.finance_audit_log(team_id, actor_id, action, entity, entity_id, before_data)
  VALUES (_row.team_id, _me, 'revoke', 'finance_permissions', _row.id, to_jsonb(_row));
END $$;

-- Aggregated overview: only boards the caller may see; team cost is aggregated, never per person.
CREATE OR REPLACE FUNCTION public.get_finance_overview(_team_id uuid, _from date, _to date)
RETURNS TABLE(board_id uuid, board_name text, competence date, gross numeric, tax numeric, direct_expenses numeric,
              team_cost numeric, hours_realized numeric, hours_planned numeric, hours_without_cost numeric, margin_target numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  months AS (SELECT generate_series(date_trunc('month', _from)::date, date_trunc('month', _to)::date, interval '1 month')::date AS m),
  bs AS (
    SELECT b.id, b.name FROM public.boards b, me
    WHERE b.team_id = _team_id AND public.can_view_finance_board(me.uid, _team_id, b.id)
  ),
  team_cfg AS (SELECT tax_rate, margin_target FROM public.finance_settings WHERE team_id = _team_id AND board_id IS NULL),
  rev AS (
    SELECT r.board_id, date_trunc('month', r.competence)::date m, sum(r.gross_amount) gross,
      sum(r.gross_amount * COALESCE(r.tax_rate, bc.tax_rate, (SELECT tax_rate FROM team_cfg), 0.21)) tax
    FROM public.finance_revenues r
    LEFT JOIN public.finance_settings bc ON bc.team_id = r.team_id AND bc.board_id = r.board_id
    WHERE r.team_id = _team_id AND r.board_id IN (SELECT id FROM bs) AND r.competence BETWEEN date_trunc('month', _from)::date AND _to
    GROUP BY 1, 2
  ),
  exp AS (
    SELECT e.board_id, date_trunc('month', e.competence)::date m, sum(e.amount) amt
    FROM public.finance_expenses e
    WHERE e.team_id = _team_id AND e.board_id IN (SELECT id FROM bs) AND e.competence BETWEEN date_trunc('month', _from)::date AND _to
    GROUP BY 1, 2
  ),
  hrs AS (
    SELECT d.board_id, date_trunc('month', t.started_at)::date m, t.user_id, sum(COALESCE(t.duration_seconds, 0)) / 3600.0 h
    FROM public.demand_time_entries t JOIN public.demands d ON d.id = t.demand_id
    WHERE d.board_id IN (SELECT id FROM bs) AND t.started_at >= date_trunc('month', _from) AND t.started_at < (date_trunc('month', _to) + interval '1 month')
    GROUP BY 1, 2, 3
  ),
  cost AS (
    SELECT h.board_id, h.m, sum(h.h) h_total,
      sum(CASE WHEN c.id IS NOT NULL THEN h.h * c.monthly_cost / c.productive_hours ELSE 0 END) cost,
      sum(CASE WHEN c.id IS NULL THEN h.h ELSE 0 END) h_missing
    FROM hrs h LEFT JOIN public.finance_employee_costs c
      ON c.team_id = _team_id AND c.user_id = h.user_id AND c.competence = h.m
    GROUP BY 1, 2
  ),
  plan AS (
    SELECT d.board_id, date_trunc('month', d.created_at)::date m, sum(COALESCE(s.estimated_hours, s.hours_max, 0)) h
    FROM public.demands d JOIN public.services s ON s.id = d.service_id
    WHERE d.board_id IN (SELECT id FROM bs) AND d.archived = false
      AND d.created_at >= date_trunc('month', _from) AND d.created_at < (date_trunc('month', _to) + interval '1 month')
    GROUP BY 1, 2
  )
  SELECT bs.id, bs.name, months.m,
    COALESCE(rev.gross, 0), COALESCE(rev.tax, 0), COALESCE(exp.amt, 0),
    COALESCE(cost.cost, 0), COALESCE(cost.h_total, 0), COALESCE(plan.h, 0), COALESCE(cost.h_missing, 0),
    COALESCE((SELECT margin_target FROM public.finance_settings fs WHERE fs.team_id = _team_id AND fs.board_id = bs.id),
             (SELECT margin_target FROM team_cfg), 0.40)
  FROM bs CROSS JOIN months
  LEFT JOIN rev ON rev.board_id = bs.id AND rev.m = months.m
  LEFT JOIN exp ON exp.board_id = bs.id AND exp.m = months.m
  LEFT JOIN cost ON cost.board_id = bs.id AND cost.m = months.m
  LEFT JOIN plan ON plan.board_id = bs.id AND plan.m = months.m
$$;

-- What the caller may do in a team (drives the UI only; RLS/RPC enforce).
CREATE OR REPLACE FUNCTION public.get_my_finance_access(_team_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'is_global_admin', public.has_role(auth.uid(), 'admin'),
    'is_team_owner', public.is_team_admin(auth.uid(), _team_id),
    'team_permissions', COALESCE((SELECT jsonb_agg(DISTINCT permission) FROM public.finance_permissions
        WHERE user_id = auth.uid() AND team_id = _team_id AND board_id IS NULL AND revoked_at IS NULL), '[]'::jsonb),
    'board_permissions', COALESCE((SELECT jsonb_agg(jsonb_build_object('board_id', fp.board_id, 'permission', fp.permission))
        FROM public.finance_permissions fp JOIN public.board_members bm ON bm.board_id = fp.board_id AND bm.user_id = fp.user_id AND bm.role::text <> 'requester'
        WHERE fp.user_id = auth.uid() AND fp.team_id = _team_id AND fp.board_id IS NOT NULL AND fp.revoked_at IS NULL), '[]'::jsonb)
  ) WHERE public.is_team_member(auth.uid(), _team_id) OR public.has_role(auth.uid(), 'admin')
$$;

REVOKE EXECUTE ON FUNCTION public.grant_finance_permission(uuid, uuid, text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.revoke_finance_permission(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_finance_overview(uuid, date, date) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_my_finance_access(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.finance_audit_trigger() FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_finance_permission(uuid, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_finance_permission(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_finance_overview(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_finance_access(uuid) TO authenticated;