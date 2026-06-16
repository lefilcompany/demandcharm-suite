CREATE OR REPLACE FUNCTION public.join_team_with_code(p_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_team_id uuid;
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_team_id 
  FROM teams 
  WHERE access_code = upper(trim(p_code));

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Invalid access code';
  END IF;

  -- Insert as requester only - never allow self-assigning higher roles
  INSERT INTO team_members (team_id, user_id, role)
  VALUES (v_team_id, v_user_id, 'requester'::team_role);

  RETURN v_team_id;
END;
$function$;