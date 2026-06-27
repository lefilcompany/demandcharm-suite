ALTER TABLE public.demands DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_assignees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_interactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_attachments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_dependencies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_time_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_share_tokens DISABLE ROW LEVEL SECURITY;
GRANT UPDATE, DELETE ON public.demands, public.demand_assignees, public.demand_interactions, public.demand_attachments, public.demand_dependencies, public.demand_time_entries, public.demand_share_tokens, public.project_demands TO sandbox_exec;