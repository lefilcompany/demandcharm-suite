-- Adicionar novo status "Aprovação do Cliente" com cor laranja do sistema
INSERT INTO public.demand_statuses (name, color, is_system) 
VALUES ('Aprovação do Cliente', '#F28705', true);