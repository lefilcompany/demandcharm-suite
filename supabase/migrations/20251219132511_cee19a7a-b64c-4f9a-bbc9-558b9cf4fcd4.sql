-- Atribuir demandas sem board_id ao board padrão da equipe
UPDATE demands d
SET board_id = (
  SELECT b.id FROM boards b 
  WHERE b.team_id = d.team_id AND b.is_default = true
  LIMIT 1
)
WHERE d.board_id IS NULL;

-- Tornar board_id obrigatório (após garantir que não há nulls)
ALTER TABLE demands ALTER COLUMN board_id SET NOT NULL;