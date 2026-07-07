REVOKE INSERT, UPDATE ON public.demand_requests FROM sandbox_exec;
ALTER TABLE public.demand_requests ENABLE TRIGGER on_demand_request_created;
ALTER TABLE public.demand_requests ENABLE TRIGGER on_demand_request_status_changed;