-- Inserir novo status "Em Ajuste"
INSERT INTO public.demand_statuses (name, color, is_system)
VALUES ('Em Ajuste', '#9333EA', true)
ON CONFLICT DO NOTHING;