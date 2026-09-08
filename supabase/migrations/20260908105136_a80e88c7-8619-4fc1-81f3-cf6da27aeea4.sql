DELETE FROM public.board_services bs
USING public.services s
WHERE bs.service_id = s.id AND s.is_active = false;