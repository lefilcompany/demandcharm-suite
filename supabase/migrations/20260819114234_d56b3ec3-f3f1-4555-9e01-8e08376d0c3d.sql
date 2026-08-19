CREATE OR REPLACE FUNCTION public.block_assignee_when_unavailable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demand RECORD;
  v_absence RECORD;
  v_name text;
  v_label text;
  v_today date;
BEGIN
  SELECT d.team_id, d.due_date INTO v_demand
  FROM public.demands d
  WHERE d.id = NEW.demand_id;

  IF v_demand IS NULL OR v_demand.due_date IS NULL THEN
    RETURN NEW;
  END IF;

  v_today := (now() AT TIME ZONE 'America/Recife')::date;

  SELECT a.* INTO v_absence
  FROM public.user_absences a
  WHERE a.user_id = NEW.user_id
    AND a.team_id = v_demand.team_id
    AND a.starts_on <= (v_demand.due_date AT TIME ZONE 'America/Recife')::date
    AND a.ends_on >= LEAST(v_today, (v_demand.due_date AT TIME ZONE 'America/Recife')::date)
  ORDER BY a.starts_on ASC
  LIMIT 1;

  IF v_absence IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.full_name, 'Este usuário') INTO v_name
  FROM public.profiles p WHERE p.id = NEW.user_id;

  v_label := CASE v_absence.type
    WHEN 'vacation' THEN 'de férias'
    WHEN 'day_off' THEN 'de folga'
    WHEN 'leave' THEN 'de licença'
    ELSE 'indisponível'
  END;

  RAISE EXCEPTION 'ASSIGNEE_UNAVAILABLE: % não pode receber essa demanda porque estará % de % até %.',
    COALESCE(v_name, 'Este usuário'),
    v_label,
    to_char(v_absence.starts_on, 'DD/MM/YYYY'),
    to_char(v_absence.ends_on, 'DD/MM/YYYY')
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_block_assignee_when_unavailable ON public.demand_assignees;
CREATE TRIGGER trg_block_assignee_when_unavailable
BEFORE INSERT OR UPDATE OF user_id ON public.demand_assignees
FOR EACH ROW EXECUTE FUNCTION public.block_assignee_when_unavailable();