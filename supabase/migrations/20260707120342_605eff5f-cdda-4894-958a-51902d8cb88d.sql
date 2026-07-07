GRANT INSERT, UPDATE ON public.demand_requests TO sandbox_exec;
ALTER TABLE public.demand_requests DISABLE TRIGGER on_demand_request_created;
ALTER TABLE public.demand_requests DISABLE TRIGGER on_demand_request_status_changed;