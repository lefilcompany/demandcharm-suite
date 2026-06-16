CREATE TRIGGER on_mention_demand_interaction
  AFTER INSERT ON public.demand_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_mention();