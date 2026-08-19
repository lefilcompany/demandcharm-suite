CREATE OR REPLACE FUNCTION public.get_team_availability(
  p_team_id uuid,
  p_at timestamptz DEFAULT now()
)
RETURNS TABLE (
  user_id uuid,
  status text,
  available_now boolean,
  status_label text,
  work_start_time time,
  work_end_time time,
  absence_type text,
  absence_starts_on date,
  absence_ends_on date,
  holiday_name text,
  next_available_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member record;
  v_tz text;
  v_local timestamp;
  v_today date;
  v_dow smallint;
  v_abs record;
  v_hol text;
  v_sch record;
  v_status text;
  v_next timestamptz;
  v_i int;
  v_d date;
  v_cand_time time;
  v_day record;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_team_member(auth.uid(), p_team_id) THEN
    RAISE EXCEPTION 'ACCESS_DENIED: usuário não pertence a esta equipe'
      USING ERRCODE = '42501';
  END IF;

  FOR v_member IN
    SELECT tm.user_id AS uid,
           COALESCE(NULLIF(p.timezone, ''), 'America/Recife') AS tz
    FROM public.team_members tm
    LEFT JOIN public.profiles p ON p.id = tm.user_id
    WHERE tm.team_id = p_team_id
  LOOP
    v_tz := v_member.tz;

    BEGIN
      v_local := p_at AT TIME ZONE v_tz;
    EXCEPTION WHEN OTHERS THEN
      v_tz := 'America/Recife';
      v_local := p_at AT TIME ZONE v_tz;
    END;

    v_today := v_local::date;
    v_dow := EXTRACT(DOW FROM v_today)::smallint;

    -- 1) ausência ativa
    SELECT a.type, a.starts_on, a.ends_on INTO v_abs
    FROM public.user_absences a
    WHERE a.team_id = p_team_id
      AND a.user_id = v_member.uid
      AND v_today BETWEEN a.starts_on AND a.ends_on
    ORDER BY a.starts_on
    LIMIT 1;

    -- 2) feriado da equipe (data local do usuário)
    SELECT h.name INTO v_hol
    FROM public.team_holidays h
    WHERE h.team_id = p_team_id AND h.date = v_today
    LIMIT 1;

    -- 3/4/5) expediente do dia
    SELECT s.start_time, s.end_time, s.is_enabled INTO v_sch
    FROM public.user_work_schedules s
    WHERE s.team_id = p_team_id
      AND s.user_id = v_member.uid
      AND s.weekday = v_dow
    LIMIT 1;

    IF v_abs.type IS NOT NULL THEN
      v_status := CASE v_abs.type
        WHEN 'vacation' THEN 'vacation'
        WHEN 'day_off'  THEN 'day_off'
        WHEN 'leave'    THEN 'leave'
        ELSE 'other_absence'
      END;
    ELSIF v_hol IS NOT NULL THEN
      v_status := 'holiday';
    ELSIF v_sch.start_time IS NULL THEN
      v_status := 'unconfigured';
    ELSIF v_sch.is_enabled IS FALSE THEN
      v_status := 'day_off';
    ELSIF v_local::time < v_sch.start_time OR v_local::time > v_sch.end_time THEN
      v_status := 'outside_hours';
    ELSE
      v_status := 'available';
    END IF;

    -- próxima disponibilidade (janela de 30 dias)
    v_next := NULL;
    IF v_status = 'available' THEN
      v_next := p_at;
    ELSE
      FOR v_i IN 0..30 LOOP
        v_d := v_today + v_i;

        IF EXISTS (
          SELECT 1 FROM public.user_absences a
          WHERE a.team_id = p_team_id AND a.user_id = v_member.uid
            AND v_d BETWEEN a.starts_on AND a.ends_on
        ) THEN CONTINUE; END IF;

        IF EXISTS (
          SELECT 1 FROM public.team_holidays h
          WHERE h.team_id = p_team_id AND h.date = v_d
        ) THEN CONTINUE; END IF;

        SELECT s.start_time, s.end_time INTO v_day
        FROM public.user_work_schedules s
        WHERE s.team_id = p_team_id
          AND s.user_id = v_member.uid
          AND s.weekday = EXTRACT(DOW FROM v_d)::smallint
          AND s.is_enabled = true
        LIMIT 1;

        IF v_day.start_time IS NULL THEN CONTINUE; END IF;

        IF v_i = 0 THEN
          IF v_local::time > v_day.end_time THEN
            CONTINUE;
          ELSIF v_local::time > v_day.start_time THEN
            v_cand_time := v_local::time;
          ELSE
            v_cand_time := v_day.start_time;
          END IF;
        ELSE
          v_cand_time := v_day.start_time;
        END IF;

        v_next := (v_d + v_cand_time) AT TIME ZONE v_tz;
        EXIT;
      END LOOP;
    END IF;

    user_id := v_member.uid;
    status := v_status;
    available_now := (v_status = 'available');
    status_label := CASE v_status
      WHEN 'available'     THEN 'Disponível'
      WHEN 'outside_hours' THEN 'Fora do horário'
      WHEN 'day_off'       THEN 'Folga'
      WHEN 'vacation'      THEN 'Férias'
      WHEN 'leave'         THEN 'Licença'
      WHEN 'other_absence' THEN 'Ausente'
      WHEN 'holiday'       THEN 'Feriado'
      ELSE 'Sem horário configurado'
    END;
    work_start_time := v_sch.start_time;
    work_end_time := v_sch.end_time;
    absence_type := v_abs.type;
    absence_starts_on := v_abs.starts_on;
    absence_ends_on := v_abs.ends_on;
    holiday_name := v_hol;
    next_available_at := v_next;
    RETURN NEXT;

    v_abs := NULL; v_sch := NULL; v_day := NULL; v_hol := NULL;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.get_team_availability(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_team_availability(uuid, timestamptz) TO authenticated, service_role;