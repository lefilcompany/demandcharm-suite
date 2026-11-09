CREATE OR REPLACE FUNCTION public._finance_project_month(_project_id uuid, _competence date)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _comp date := date_trunc('month', _competence)::date; _d jsonb; _st text; _pid uuid; _boards uuid[]; _a jsonb; _list jsonb;
BEGIN
  SELECT s.data, p.status, p.id INTO _d, _st, _pid FROM finance_project_snapshots s JOIN finance_periods p ON p.id = s.period_id
    WHERE s.project_id = _project_id AND s.competence = _comp;
  IF _d IS NOT NULL AND _st <> 'open' THEN
    SELECT coalesce(array_agg(x::uuid), '{}') INTO _boards FROM jsonb_array_elements_text(coalesce(_d->'board_ids','[]'::jsonb)) x;
    SELECT jsonb_object_agg(target, total) INTO _a FROM (
      SELECT target, round(sum(amount), 2) total FROM finance_period_adjustments
      WHERE period_id = _pid AND board_id = ANY(_boards) GROUP BY target) t;
    SELECT coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'board_id', a.board_id, 'board_name', b.name, 'target', a.target,
      'amount', a.amount, 'reason', a.reason, 'created_by', a.created_by, 'author', pr.full_name, 'created_at', a.created_at) ORDER BY a.created_at), '[]'::jsonb)
      INTO _list FROM finance_period_adjustments a LEFT JOIN boards b ON b.id = a.board_id LEFT JOIN profiles pr ON pr.id = a.created_by
      WHERE a.period_id = _pid AND a.board_id = ANY(_boards);
    IF _a IS NOT NULL THEN
      _d := _d || jsonb_build_object(
        'gross', round((_d->>'gross')::numeric + coalesce((_a->>'gross')::numeric, 0), 2),
        'tax', round((_d->>'tax')::numeric + coalesce((_a->>'tax')::numeric, 0), 2),
        'direct_expenses', round((_d->>'direct_expenses')::numeric + coalesce((_a->>'direct_expenses')::numeric, 0), 2),
        'alloc_admin', round((_d->>'alloc_admin')::numeric + coalesce((_a->>'allocated_expenses')::numeric, 0), 2),
        'team_cost', round((_d->>'team_cost')::numeric + coalesce((_a->>'team_cost')::numeric, 0), 2));
    END IF;
    RETURN _d || jsonb_build_object('period_status', _st, 'from_snapshot', true,
      'has_adjustments', _a IS NOT NULL, 'adjustments', _list);
  END IF;
  RETURN public._finance_project_month_live(_project_id, _comp) || jsonb_build_object('from_snapshot', false, 'has_adjustments', false, 'adjustments', '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public._finance_project_month(uuid, date) FROM PUBLIC, anon, authenticated;