-- 1) Garantir leitura de membros do quadro por administradores/coordenadores da equipe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'board_members'
      AND policyname = 'Team admins/moderators can view board members'
  ) THEN
    CREATE POLICY "Team admins/moderators can view board members"
      ON public.board_members
      FOR SELECT
      USING (public.is_team_admin_or_moderator_for_board(auth.uid(), board_id));
  END IF;
END $$;

-- 2) Garantir leitura de serviços do quadro por administradores/coordenadores da equipe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'board_services'
      AND policyname = 'Team admins/moderators can view board services'
  ) THEN
    CREATE POLICY "Team admins/moderators can view board services"
      ON public.board_services
      FOR SELECT
      USING (public.is_team_admin_or_moderator_for_board(auth.uid(), board_id));
  END IF;
END $$;

-- 3) Trigger para garantir vínculo automático de admins/coordenadores a novos quadros
CREATE OR REPLACE FUNCTION public.add_management_members_to_board()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.board_members (board_id, user_id, role, added_by)
  SELECT
    NEW.id,
    tm.user_id,
    tm.role,
    NEW.created_by
  FROM public.team_members tm
  WHERE tm.team_id = NEW.team_id
    AND tm.role IN ('admin'::public.team_role, 'moderator'::public.team_role)
  ON CONFLICT (board_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger tg
    JOIN pg_class c ON c.oid = tg.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'boards'
      AND tg.tgname = 'on_board_created_add_management_members'
      AND NOT tg.tgisinternal
  ) THEN
    CREATE TRIGGER on_board_created_add_management_members
    AFTER INSERT ON public.boards
    FOR EACH ROW
    EXECUTE FUNCTION public.add_management_members_to_board();
  END IF;
END $$;

-- 4) Backfill: garantir que admins/coordenadores atuais estejam vinculados em todos os quadros da equipe
INSERT INTO public.board_members (board_id, user_id, role, added_by)
SELECT
  b.id,
  tm.user_id,
  tm.role,
  COALESCE(b.created_by, tm.user_id)
FROM public.boards b
JOIN public.team_members tm
  ON tm.team_id = b.team_id
 AND tm.role IN ('admin'::public.team_role, 'moderator'::public.team_role)
LEFT JOIN public.board_members bm
  ON bm.board_id = b.id
 AND bm.user_id = tm.user_id
WHERE bm.id IS NULL
ON CONFLICT (board_id, user_id)
DO UPDATE SET role = EXCLUDED.role;