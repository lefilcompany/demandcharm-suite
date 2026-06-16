
CREATE OR REPLACE FUNCTION public.promote_to_admin_by_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = lower(p_email);
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  UPDATE public.user_roles SET role = 'admin' WHERE user_id = v_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'admin');
  END IF;
END;
$$;
