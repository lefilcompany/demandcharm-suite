DROP TRIGGER IF EXISTS on_board_created_init_statuses ON public.boards;
DROP FUNCTION IF EXISTS public.initialize_board_statuses();