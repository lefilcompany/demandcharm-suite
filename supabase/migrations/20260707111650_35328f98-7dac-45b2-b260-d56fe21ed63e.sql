REVOKE INSERT, UPDATE ON public.boards FROM sandbox_exec;
REVOKE INSERT, UPDATE ON public.demands FROM sandbox_exec;
ALTER TABLE public.boards ENABLE TRIGGER trg_enforce_board_limit;
ALTER TABLE public.demands ENABLE TRIGGER USER;