-- Create demand_requests table for pending demand requests from Solicitantes
CREATE TABLE public.demand_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'média',
  service_id UUID REFERENCES public.services(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'returned')),
  rejection_reason TEXT,
  responded_by UUID REFERENCES public.profiles(id),
  responded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demand_requests ENABLE ROW LEVEL SECURITY;

-- Policies for demand_requests
CREATE POLICY "Solicitantes can create their own requests"
ON public.demand_requests
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can view their own requests"
ON public.demand_requests
FOR SELECT
USING (auth.uid() = created_by);

CREATE POLICY "Admins and moderators can view team requests"
ON public.demand_requests
FOR SELECT
USING (is_team_admin_or_moderator(auth.uid(), team_id));

CREATE POLICY "Users can update their own pending/returned requests"
ON public.demand_requests
FOR UPDATE
USING (auth.uid() = created_by AND status IN ('pending', 'returned'));

CREATE POLICY "Admins and moderators can update team requests"
ON public.demand_requests
FOR UPDATE
USING (is_team_admin_or_moderator(auth.uid(), team_id));

CREATE POLICY "Users can delete their own pending requests"
ON public.demand_requests
FOR DELETE
USING (auth.uid() = created_by AND status = 'pending');

-- Trigger for updated_at
CREATE TRIGGER update_demand_requests_updated_at
BEFORE UPDATE ON public.demand_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Function to notify admins when a new demand request is created
CREATE OR REPLACE FUNCTION public.notify_demand_request_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_member RECORD;
  requester_name TEXT;
  team_name TEXT;
BEGIN
  -- Get requester name and team name
  SELECT full_name INTO requester_name FROM profiles WHERE id = NEW.created_by;
  SELECT name INTO team_name FROM teams WHERE id = NEW.team_id;
  
  -- Notify all admins and moderators of the team
  FOR admin_member IN 
    SELECT user_id FROM team_members 
    WHERE team_id = NEW.team_id 
    AND role IN ('admin', 'moderator')
    AND user_id != NEW.created_by
  LOOP
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      admin_member.user_id,
      'Nova solicitação de demanda',
      requester_name || ' solicitou a criação de uma demanda: "' || NEW.title || '"',
      'info',
      '/demand-requests'
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Trigger for notifying admins on new request
CREATE TRIGGER on_demand_request_created
AFTER INSERT ON public.demand_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_demand_request_created();

-- Function to notify requester when request status changes
CREATE OR REPLACE FUNCTION public.notify_demand_request_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  responder_name TEXT;
BEGIN
  -- Only trigger if status actually changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get responder name
  SELECT full_name INTO responder_name FROM profiles WHERE id = NEW.responded_by;
  
  IF NEW.status = 'approved' THEN
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      NEW.created_by,
      'Solicitação aprovada!',
      'Sua solicitação de demanda "' || NEW.title || '" foi aprovada por ' || responder_name,
      'success',
      '/demands'
    );
  ELSIF NEW.status = 'rejected' THEN
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      NEW.created_by,
      'Solicitação rejeitada',
      'Sua solicitação "' || NEW.title || '" foi rejeitada. Motivo: ' || COALESCE(NEW.rejection_reason, 'Não informado'),
      'error',
      '/my-requests'
    );
  ELSIF NEW.status = 'returned' THEN
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
      NEW.created_by,
      'Solicitação devolvida para revisão',
      'Sua solicitação "' || NEW.title || '" foi devolvida: ' || COALESCE(NEW.rejection_reason, 'Ajustes necessários'),
      'warning',
      '/my-requests'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for notifying requester on status change
CREATE TRIGGER on_demand_request_status_changed
AFTER UPDATE ON public.demand_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_demand_request_status_changed();