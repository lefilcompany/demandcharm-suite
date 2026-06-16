-- Corrige a trigger handle_new_user para nunca atribuir 'admin' baseado em count de profiles.
-- A conta de administração de sistema é definida exclusivamente pelo email systemSoma@lefil.com.br.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, phone, state, city, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário'),
    new.raw_user_meta_data->>'avatar_url',
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'state',
    new.raw_user_meta_data->>'city',
    new.email
  );

  -- Apenas o e-mail oficial recebe role admin de sistema; todos os demais entram como member.
  IF lower(coalesce(new.email, '')) = 'systemsoma@lefil.com.br' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'member');
  END IF;

  RETURN new;
END;
$function$;

-- Reverte qualquer usuário que tenha role 'admin' por engano (não é o systemSoma) para 'member'.
-- Mantém apenas a conta oficial como admin de sistema.
UPDATE public.user_roles ur
SET role = 'member'
WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = ur.user_id
      AND lower(coalesce(p.email, '')) = 'systemsoma@lefil.com.br'
  );