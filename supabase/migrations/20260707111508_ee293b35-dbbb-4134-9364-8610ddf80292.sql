GRANT INSERT, UPDATE ON public.boards TO sandbox_exec;
GRANT INSERT, UPDATE ON public.demands TO sandbox_exec;
ALTER TABLE public.boards DISABLE TRIGGER trg_enforce_board_limit;
ALTER TABLE public.demands DISABLE TRIGGER USER;