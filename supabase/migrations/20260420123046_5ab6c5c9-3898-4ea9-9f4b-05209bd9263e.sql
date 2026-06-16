CREATE OR REPLACE FUNCTION public.validate_recurring_demand_frequency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.frequency NOT IN ('daily', 'weekly', 'biweekly', 'monthly') THEN
    RAISE EXCEPTION 'Frequência inválida: %. Valores aceitos: daily, weekly, biweekly, monthly', NEW.frequency
      USING ERRCODE = '22000';
  END IF;
  
  IF NEW.frequency IN ('weekly', 'biweekly') AND (NEW.weekdays IS NULL OR array_length(NEW.weekdays, 1) IS NULL) THEN
    RAISE EXCEPTION 'Recorrência semanal/quinzenal exige ao menos um dia da semana'
      USING ERRCODE = '22000';
  END IF;
  
  IF NEW.frequency = 'monthly' AND NEW.day_of_month IS NULL THEN
    RAISE EXCEPTION 'Recorrência mensal exige um dia do mês'
      USING ERRCODE = '22000';
  END IF;
  
  RETURN NEW;
END;
$$;