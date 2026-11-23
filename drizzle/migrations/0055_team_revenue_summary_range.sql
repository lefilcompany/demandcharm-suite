CREATE OR REPLACE FUNCTION public.get_team_revenue_summary_range(_team_id uuid, _from date, _to date)
 RETURNS jsonb LANGUAGE sql STABLE SET search_path TO 'public'
AS $function$
  WITH r AS (
    SELECT fr.project_id, date_trunc('month', fr.competence)::date m, sum(fr.gross_amount) gross
    FROM finance_revenues fr
    WHERE fr.team_id = _team_id
      AND date_trunc('month', fr.competence) BETWEEN date_trunc('month', _from) AND date_trunc('month', _to)
    GROUP BY 1, 2
  ), rt AS (
    SELECT r.*, coalesce((SELECT tax_rate FROM finance_team_defaults d WHERE d.team_id = _team_id AND d.valid_from <= r.m ORDER BY d.valid_from DESC LIMIT 1),
                         (SELECT tax_rate FROM finance_settings s WHERE s.team_id = _team_id AND s.board_id IS NULL LIMIT 1), 0.21) t
    FROM r
  ), rows AS (
    SELECT rt.project_id, coalesce(p.name, 'Sem projeto') name, sum(rt.gross) gross, sum(rt.gross * rt.t) tax
    FROM rt LEFT JOIN projects p ON p.id = rt.project_id GROUP BY 1, 2
  ), cur AS (
    SELECT coalesce((SELECT tax_rate FROM finance_team_defaults WHERE team_id = _team_id AND valid_from <= date_trunc('month', _to)::date ORDER BY valid_from DESC LIMIT 1),
                    (SELECT tax_rate FROM finance_settings WHERE team_id = _team_id AND board_id IS NULL LIMIT 1), 0.21) t
  )
  SELECT jsonb_build_object(
    'tax_rate', CASE WHEN coalesce((SELECT sum(gross) FROM rows), 0) > 0 THEN (SELECT sum(tax) / sum(gross) FROM rows) ELSE (SELECT t FROM cur) END,
    'gross', round(coalesce((SELECT sum(gross) FROM rows), 0), 2),
    'tax', round(coalesce((SELECT sum(tax) FROM rows), 0), 2),
    'projects', coalesce((SELECT jsonb_agg(jsonb_build_object('project_id', project_id, 'name', name, 'gross', round(gross, 2)) ORDER BY project_id IS NULL, gross DESC) FROM rows), '[]'::jsonb))
$function$;
GRANT EXECUTE ON FUNCTION public.get_team_revenue_summary_range(uuid, date, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_team_revenue_summary_range(uuid, date, date) FROM anon, public;