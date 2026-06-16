-- 1. Criar os triggers necessários (se não existirem)

-- Trigger: criar board padrão quando equipe é criada
DROP TRIGGER IF EXISTS on_team_created ON teams;
CREATE TRIGGER on_team_created
  AFTER INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION create_default_board();

-- Trigger: adicionar membro ao board padrão quando entra na equipe
DROP TRIGGER IF EXISTS on_team_member_added ON team_members;
CREATE TRIGGER on_team_member_added
  AFTER INSERT ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION add_member_to_default_board();

-- Trigger: adicionar criador como admin do novo board
DROP TRIGGER IF EXISTS on_board_created ON boards;
CREATE TRIGGER on_board_created
  AFTER INSERT ON boards
  FOR EACH ROW
  EXECUTE FUNCTION add_creator_to_board();

-- 2. Ajustar política RLS de SELECT em boards para membros da equipe verem boards
DROP POLICY IF EXISTS "Members can view their boards" ON boards;

CREATE POLICY "Team members can view team boards" ON boards
  FOR SELECT
  USING (
    team_id IN (SELECT get_user_team_ids(auth.uid()))
  );

-- 3. Ajustar política de INSERT em boards para incluir executores
DROP POLICY IF EXISTS "Team admins/moderators can create boards" ON boards;

CREATE POLICY "Team admins/moderators/executors can create boards" ON boards
  FOR INSERT
  WITH CHECK (
    auth.uid() = created_by 
    AND (
      has_team_role(auth.uid(), team_id, 'admin') 
      OR has_team_role(auth.uid(), team_id, 'moderator')
      OR has_team_role(auth.uid(), team_id, 'executor')
      OR is_board_admin_in_team(auth.uid(), team_id)
    )
  );

-- 4. Corrigir dados existentes - adicionar membros faltando nos boards padrão
INSERT INTO board_members (board_id, user_id, role, added_by)
SELECT 
  b.id as board_id,
  tm.user_id,
  CASE 
    WHEN tm.role = 'admin' THEN 'admin'::team_role
    WHEN tm.role = 'moderator' THEN 'moderator'::team_role
    ELSE 'requester'::team_role
  END,
  tm.user_id
FROM team_members tm
JOIN boards b ON b.team_id = tm.team_id AND b.is_default = true
WHERE NOT EXISTS (
  SELECT 1 FROM board_members bm 
  WHERE bm.board_id = b.id AND bm.user_id = tm.user_id
)
ON CONFLICT (board_id, user_id) DO NOTHING;