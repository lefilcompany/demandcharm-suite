-- Criar enum para tipo de ajuste (se não existir)
DO $$ BEGIN
  CREATE TYPE adjustment_type AS ENUM ('none', 'internal', 'external');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Adicionar coluna adjustment_type na tabela board_statuses
ALTER TABLE board_statuses 
ADD COLUMN IF NOT EXISTS adjustment_type adjustment_type DEFAULT 'none';

-- Criar status de sistema "Aprovação Interna" (verificando se não existe)
INSERT INTO demand_statuses (name, color, is_system)
SELECT 'Aprovação Interna', '#3B82F6', true
WHERE NOT EXISTS (
  SELECT 1 FROM demand_statuses WHERE name = 'Aprovação Interna'
);

-- Atualizar board_statuses existentes para "Aprovação do Cliente" com adjustment_type = 'external'
UPDATE board_statuses bs
SET adjustment_type = 'external'
FROM demand_statuses ds
WHERE bs.status_id = ds.id AND ds.name = 'Aprovação do Cliente';

-- Atualizar ou criar a função initialize_board_statuses para incluir "Aprovação Interna"
CREATE OR REPLACE FUNCTION initialize_board_statuses()
RETURNS TRIGGER AS $$
DECLARE
  status_record RECORD;
  position_counter INT := 0;
  status_adjustment_type adjustment_type;
BEGIN
  -- Definir os status na ordem desejada com seus tipos de ajuste
  FOR status_record IN 
    SELECT id, name FROM demand_statuses 
    WHERE is_system = true 
    ORDER BY 
      CASE name
        WHEN 'A Iniciar' THEN 1
        WHEN 'Fazendo' THEN 2
        WHEN 'Em Ajuste' THEN 3
        WHEN 'Aprovação Interna' THEN 4
        WHEN 'Aprovação do Cliente' THEN 5
        WHEN 'Entregue' THEN 6
        ELSE 99
      END
  LOOP
    -- Determinar o tipo de ajuste baseado no nome do status
    CASE status_record.name
      WHEN 'Aprovação Interna' THEN
        status_adjustment_type := 'internal';
      WHEN 'Aprovação do Cliente' THEN
        status_adjustment_type := 'external';
      ELSE
        status_adjustment_type := 'none';
    END CASE;
    
    INSERT INTO board_statuses (board_id, status_id, position, is_active, adjustment_type)
    VALUES (NEW.id, status_record.id, position_counter, true, status_adjustment_type);
    position_counter := position_counter + 1;
  END LOOP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Adicionar "Aprovação Interna" aos boards existentes que ainda não têm
DO $$
DECLARE
  board_record RECORD;
  aprovacao_interna_id UUID;
  aprovacao_cliente_position INT;
BEGIN
  -- Obter o ID do status "Aprovação Interna"
  SELECT id INTO aprovacao_interna_id FROM demand_statuses WHERE name = 'Aprovação Interna';
  
  IF aprovacao_interna_id IS NOT NULL THEN
    -- Para cada board
    FOR board_record IN SELECT id FROM boards LOOP
      -- Verificar se já existe "Aprovação Interna" neste board
      IF NOT EXISTS (
        SELECT 1 FROM board_statuses 
        WHERE board_id = board_record.id AND status_id = aprovacao_interna_id
      ) THEN
        -- Obter a posição do "Aprovação do Cliente"
        SELECT position INTO aprovacao_cliente_position 
        FROM board_statuses bs
        JOIN demand_statuses ds ON bs.status_id = ds.id
        WHERE bs.board_id = board_record.id AND ds.name = 'Aprovação do Cliente';
        
        IF aprovacao_cliente_position IS NOT NULL THEN
          -- Incrementar posições >= aprovacao_cliente_position
          UPDATE board_statuses 
          SET position = position + 1 
          WHERE board_id = board_record.id AND position >= aprovacao_cliente_position;
          
          -- Inserir "Aprovação Interna" na posição anterior a "Aprovação do Cliente"
          INSERT INTO board_statuses (board_id, status_id, position, is_active, adjustment_type)
          VALUES (board_record.id, aprovacao_interna_id, aprovacao_cliente_position, true, 'internal');
        END IF;
      ELSE
        -- Atualizar adjustment_type se já existe
        UPDATE board_statuses 
        SET adjustment_type = 'internal'
        WHERE board_id = board_record.id AND status_id = aprovacao_interna_id;
      END IF;
    END LOOP;
  END IF;
END $$;