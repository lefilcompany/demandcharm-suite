CREATE OR REPLACE FUNCTION public._availability_selftest()
RETURNS TABLE(name text, passed boolean, detail text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_user uuid := '78a77478-90d8-43c9-b5e6-6aef90315c3e';
  v_team uuid := gen_random_uuid();
  r record;
  res text[][] := ARRAY[]::text[][];
  results text[] := ARRAY[]::text[];

  PROCEDURE_PLACEHOLDER int;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user::text, 'role','authenticated')::text, true);

    INSERT INTO public.teams (id, name, created_by) VALUES (v_team, 'ZZ_TEST_AVAIL', v_user);
    INSERT INTO public.team_members (team_id, user_id, role) VALUES (v_team, v_user, 'admin');

    -- schedule: mon-fri 08:00-18:00, sat 09:00-13:00, sun disabled
    INSERT INTO public.user_work_schedules (team_id, user_id, weekday, start_time, end_time, is_enabled)
    VALUES (v_team,v_user,1,'08:00','18:00',true),
           (v_team,v_user,2,'08:00','18:00',true),
           (v_team,v_user,3,'08:00','18:00',true),
           (v_team,v_user,4,'08:00','18:00',true),
           (v_team,v_user,5,'08:00','18:00',true),
           (v_team,v_user,6,'09:00','13:00',true),
           (v_team,v_user,0,'08:00','18:00',false);

    -- helper macro via loop of cases
    FOR r IN
      SELECT * FROM (VALUES
        ('mon_midday',      '2026-06-01T15:00:00Z'::timestamptz, 'available'),
        ('mon_exact_start', '2026-06-01T11:00:00Z'::timestamptz, 'available'),
        ('mon_exact_end',   '2026-06-01T21:00:00Z'::timestamptz, 'available'),
        ('mon_before',      '2026-06-01T10:59:00Z'::timestamptz, 'outside_hours'),
        ('mon_after',       '2026-06-01T21:01:00Z'::timestamptz, 'outside_hours'),
        ('fri_midday',      '2026-06-05T15:00:00Z'::timestamptz, 'available'),
        ('sat_10',          '2026-06-06T13:00:00Z'::timestamptz, 'available'),
        ('sat_14',          '2026-06-06T17:00:00Z'::timestamptz, 'outside_hours'),
        ('sun_disabled',    '2026-06-07T13:00:00Z'::timestamptz, 'day_off'),
        ('tz_recife_0730',  '2026-06-01T10:30:00Z'::timestamptz, 'outside_hours')
      ) t(nm, at, expected)
    LOOP
      DECLARE got text; nx timestamptz; BEGIN
        SELECT a.status, a.next_available_at INTO got, nx FROM public.get_team_availability(v_team, r.at) a WHERE a.user_id = v_user;
        results := results || format('%s|%s|got=%s exp=%s next=%s', r.nm, (got = r.expected), got, r.expected, nx);
      END;
    END LOOP;

    -- next_available_at checks
    DECLARE nx timestamptz; st text; BEGIN
      SELECT a.next_available_at INTO nx FROM public.get_team_availability(v_team, '2026-06-01T10:00:00Z') a WHERE a.user_id=v_user; -- mon 07:00 local
      results := results || format('next_before_hours|%s|%s', nx = '2026-06-01T11:00:00Z'::timestamptz, nx);
      SELECT a.next_available_at INTO nx FROM public.get_team_availability(v_team, '2026-06-01T22:00:00Z') a WHERE a.user_id=v_user; -- mon 19:00
      results := results || format('next_after_hours|%s|%s', nx = '2026-06-02T11:00:00Z'::timestamptz, nx);
      SELECT a.next_available_at INTO nx FROM public.get_team_availability(v_team, '2026-06-05T22:00:00Z') a WHERE a.user_id=v_user; -- fri 19:00 -> sat 09
      results := results || format('next_fri_evening|%s|%s', nx = '2026-06-06T12:00:00Z'::timestamptz, nx);
      SELECT a.next_available_at INTO nx FROM public.get_team_availability(v_team, '2026-06-06T17:00:00Z') a WHERE a.user_id=v_user; -- sat 14:00 -> mon 08
      results := results || format('next_sat_evening|%s|%s', nx = '2026-06-08T11:00:00Z'::timestamptz, nx);
      SELECT a.next_available_at INTO nx FROM public.get_team_availability(v_team, '2026-06-07T13:00:00Z') a WHERE a.user_id=v_user; -- sun -> mon 08
      results := results || format('next_sunday|%s|%s', nx = '2026-06-08T11:00:00Z'::timestamptz, nx);
    END;

    -- holiday
    INSERT INTO public.team_holidays (team_id, date, name) VALUES (v_team, '2026-06-02', 'Feriado Teste');
    DECLARE got text; nx timestamptz; hn text; BEGIN
      SELECT a.status, a.next_available_at, a.holiday_name INTO got, nx, hn FROM public.get_team_availability(v_team,'2026-06-02T15:00:00Z') a WHERE a.user_id=v_user;
      results := results || format('holiday_status|%s|got=%s name=%s next=%s(exp 2026-06-03 11:00Z)', got='holiday' AND hn='Feriado Teste' AND nx='2026-06-03T11:00:00Z'::timestamptz, got, hn, nx);
    END;

    -- absences
    INSERT INTO public.user_absences (team_id,user_id,type,starts_on,ends_on) VALUES (v_team,v_user,'vacation','2026-06-02','2026-06-04');
    FOR r IN SELECT * FROM (VALUES
        ('abs_day_before','2026-06-01T15:00:00Z'::timestamptz,'available'),
        ('abs_first_day', '2026-06-02T15:00:00Z'::timestamptz,'vacation'),
        ('abs_last_day',  '2026-06-04T15:00:00Z'::timestamptz,'vacation'),
        ('abs_day_after', '2026-06-05T15:00:00Z'::timestamptz,'available')
      ) t(nm,at,expected)
    LOOP
      DECLARE got text; nx timestamptz; BEGIN
        SELECT a.status, a.next_available_at INTO got, nx FROM public.get_team_availability(v_team,r.at) a WHERE a.user_id=v_user;
        results := results || format('%s|%s|got=%s exp=%s next=%s', r.nm,(got=r.expected), got, r.expected, nx);
      END;
    END LOOP;
    -- precedence: 2026-06-02 is both holiday and vacation -> vacation (checked above as abs_first_day)

    -- next_available during vacation (should be 2026-06-05 08:00 local = 11:00Z)
    DECLARE nx timestamptz; BEGIN
      SELECT a.next_available_at INTO nx FROM public.get_team_availability(v_team,'2026-06-02T15:00:00Z') a WHERE a.user_id=v_user;
      results := results || format('next_during_vacation|%s|%s', nx='2026-06-05T11:00:00Z'::timestamptz, nx);
    END;

    UPDATE public.user_absences SET type='day_off' WHERE team_id=v_team;
    DECLARE got text; BEGIN
      SELECT a.status INTO got FROM public.get_team_availability(v_team,'2026-06-03T15:00:00Z') a WHERE a.user_id=v_user;
      results := results || format('abs_day_off|%s|%s', got='day_off', got);
    END;
    UPDATE public.user_absences SET type='leave' WHERE team_id=v_team;
    DECLARE got text; BEGIN
      SELECT a.status INTO got FROM public.get_team_availability(v_team,'2026-06-03T15:00:00Z') a WHERE a.user_id=v_user;
      results := results || format('abs_leave|%s|%s', got='leave', got);
    END;
    UPDATE public.user_absences SET type='other' WHERE team_id=v_team;
    DECLARE got text; BEGIN
      SELECT a.status INTO got FROM public.get_team_availability(v_team,'2026-06-03T15:00:00Z') a WHERE a.user_id=v_user;
      results := results || format('abs_other|%s|%s', got='other_absence', got);
    END;
    DELETE FROM public.user_absences WHERE team_id=v_team;
    DELETE FROM public.team_holidays WHERE team_id=v_team;

    -- timezone: sao paulo
    UPDATE public.profiles SET timezone='America/Sao_Paulo' WHERE id=v_user;
    DECLARE got text; BEGIN
      SELECT a.status INTO got FROM public.get_team_availability(v_team,'2026-06-01T10:30:00Z') a WHERE a.user_id=v_user;
      results := results || format('tz_sp_0730|%s|%s', got='outside_hours', got);
    END;
    UPDATE public.profiles SET timezone='Europe/Lisbon' WHERE id=v_user; -- UTC+1 -> 11:30 local = available
    DECLARE got text; BEGIN
      SELECT a.status INTO got FROM public.get_team_availability(v_team,'2026-06-01T10:30:00Z') a WHERE a.user_id=v_user;
      results := results || format('tz_lisbon_1130|%s|%s (deve ser available, prova que usa tz do usuario)', got='available', got);
    END;
    UPDATE public.profiles SET timezone='Fuso/Invalido' WHERE id=v_user;
    DECLARE got text; BEGIN
      SELECT a.status INTO got FROM public.get_team_availability(v_team,'2026-06-01T10:30:00Z') a WHERE a.user_id=v_user;
      results := results || format('tz_invalid_fallback|%s|%s', got='outside_hours', got);
    EXCEPTION WHEN OTHERS THEN
      results := results || format('tz_invalid_fallback|false|EXCEPTION %s', SQLERRM);
    END;
    UPDATE public.profiles SET timezone=NULL WHERE id=v_user;

    -- unconfigured
    DELETE FROM public.user_work_schedules WHERE team_id=v_team;
    DECLARE got text; nx timestamptz; BEGIN
      SELECT a.status, a.next_available_at INTO got, nx FROM public.get_team_availability(v_team,'2026-06-01T15:00:00Z') a WHERE a.user_id=v_user;
      results := results || format('unconfigured|%s|got=%s next=%s', got='unconfigured' AND nx IS NULL, got, nx);
    END;

    -- security: non-member
    PERFORM set_config('request.jwt.claims', json_build_object('sub','6d20cf74-f5f7-4f62-bdc5-50e8987e675b','role','authenticated')::text, true);
    DECLARE got int; BEGIN
      SELECT count(*) INTO got FROM public.get_team_availability(v_team,'2026-06-01T15:00:00Z');
      results := results || format('security_non_member|false|retornou %s linhas sem erro', got);
    EXCEPTION WHEN OTHERS THEN
      results := results || format('security_non_member|true|bloqueado: %s', SQLERRM);
    END;

    RAISE EXCEPTION 'ROLLBACK_TEST';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'ROLLBACK_TEST' THEN
      results := results || format('FATAL|false|%s', SQLERRM);
    END IF;
  END;

  FOR r IN SELECT unnest(results) AS line LOOP
    name := split_part(r.line,'|',1);
    passed := split_part(r.line,'|',2) = 'true';
    detail := split_part(r.line,'|',3);
    RETURN NEXT;
  END LOOP;
END;
$fn$;