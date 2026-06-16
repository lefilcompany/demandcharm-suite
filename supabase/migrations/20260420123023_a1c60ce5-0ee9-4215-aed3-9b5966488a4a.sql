-- 1. Adiciona coluna para vincular demandas geradas pela recorrência (e a demanda "âncora" criada no momento do save)
ALTER TABLE public.demands
  ADD COLUMN IF NOT EXISTS recurring_demand_id UUID REFERENCES public.recurring_demands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_demands_recurring_demand_id ON public.demands(recurring_demand_id);

-- 2. Limpa frequências legadas inválidas no banco antes de criar a constraint
UPDATE public.recurring_demands
SET is_active = false
WHERE frequency NOT IN ('daily', 'weekly', 'biweekly', 'monthly');

-- 3. Função de validação (trigger em vez de CHECK constraint para flexibilidade futura)
CREATE OR REPLACE FUNCTION public.validate_recurring_demand_frequency()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.frequency NOT IN ('daily', 'weekly', 'biweekly', 'monthly') THEN
    RAISE EXCEPTION 'Frequência inválida: %. Valores aceitos: daily, weekly, biweekly, monthly', NEW.frequency
      USING ERRCODE = '22000';
  END IF;
  
  -- weekly e biweekly precisam ter ao menos um dia da semana selecionado
  IF NEW.frequency IN ('weekly', 'biweekly') AND (NEW.weekdays IS NULL OR array_length(NEW.weekdays, 1) IS NULL) THEN
    RAISE EXCEPTION 'Recorrência semanal/quinzenal exige ao menos um dia da semana'
      USING ERRCODE = '22000';
  END IF;
  
  -- monthly precisa do day_of_month
  IF NEW.frequency = 'monthly' AND NEW.day_of_month IS NULL THEN
    RAISE EXCEPTION 'Recorrência mensal exige um dia do mês'
      USING ERRCODE = '22000';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_recurring_demand_frequency_trigger ON public.recurring_demands;
CREATE TRIGGER validate_recurring_demand_frequency_trigger
  BEFORE INSERT OR UPDATE ON public.recurring_demands
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_recurring_demand_frequency();