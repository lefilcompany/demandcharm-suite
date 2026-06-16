-- Tabela de subtarefas das demandas
CREATE TABLE public.demand_subtasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.demand_subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view subtasks"
ON public.demand_subtasks FOR SELECT
USING (demand_id IN (
  SELECT d.id FROM demands d WHERE d.team_id IN (SELECT get_user_team_ids(auth.uid()))
));

CREATE POLICY "Team members can create subtasks"
ON public.demand_subtasks FOR INSERT
WITH CHECK (demand_id IN (
  SELECT d.id FROM demands d WHERE d.team_id IN (SELECT get_user_team_ids(auth.uid()))
));

CREATE POLICY "Team members can update subtasks"
ON public.demand_subtasks FOR UPDATE
USING (demand_id IN (
  SELECT d.id FROM demands d WHERE d.team_id IN (SELECT get_user_team_ids(auth.uid()))
));

CREATE POLICY "Team members can delete subtasks"
ON public.demand_subtasks FOR DELETE
USING (demand_id IN (
  SELECT d.id FROM demands d WHERE d.team_id IN (SELECT get_user_team_ids(auth.uid()))
));

-- Tabela de anexos das demandas
CREATE TABLE public.demand_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  demand_id UUID NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.demand_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view attachments"
ON public.demand_attachments FOR SELECT
USING (demand_id IN (
  SELECT d.id FROM demands d WHERE d.team_id IN (SELECT get_user_team_ids(auth.uid()))
));

CREATE POLICY "Team members can upload attachments"
ON public.demand_attachments FOR INSERT
WITH CHECK (demand_id IN (
  SELECT d.id FROM demands d WHERE d.team_id IN (SELECT get_user_team_ids(auth.uid()))
) AND uploaded_by = auth.uid());

CREATE POLICY "Users can delete own attachments"
ON public.demand_attachments FOR DELETE
USING (uploaded_by = auth.uid());

-- Tabela de templates de demanda
CREATE TABLE public.demand_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title_template TEXT,
  description_template TEXT,
  priority TEXT DEFAULT 'média',
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.demand_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view templates"
ON public.demand_templates FOR SELECT
USING (team_id IN (SELECT get_user_team_ids(auth.uid())));

CREATE POLICY "Team admins can create templates"
ON public.demand_templates FOR INSERT
WITH CHECK (is_team_admin_or_moderator(auth.uid(), team_id));

CREATE POLICY "Team admins can update templates"
ON public.demand_templates FOR UPDATE
USING (is_team_admin_or_moderator(auth.uid(), team_id));

CREATE POLICY "Team admins can delete templates"
ON public.demand_templates FOR DELETE
USING (is_team_admin_or_moderator(auth.uid(), team_id));

-- Storage bucket para anexos
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('demand-attachments', 'demand-attachments', true, 10485760);

-- Políticas de storage
CREATE POLICY "Team members can upload attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'demand-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'demand-attachments');

CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'demand-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger para notificar menções
CREATE OR REPLACE FUNCTION public.notify_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  mentioned_user_id UUID;
  mention_pattern TEXT;
  demand_title TEXT;
BEGIN
  -- Get demand title
  SELECT title INTO demand_title FROM demands WHERE id = NEW.demand_id;
  
  -- Find all @mentions in content
  FOR mention_pattern IN 
    SELECT (regexp_matches(NEW.content, '@([a-zA-Z0-9_-]+)', 'g'))[1]
  LOOP
    -- Find user by name
    SELECT id INTO mentioned_user_id 
    FROM profiles 
    WHERE LOWER(full_name) LIKE LOWER('%' || mention_pattern || '%')
    LIMIT 1;
    
    IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, title, message, type, link)
      VALUES (
        mentioned_user_id,
        'Você foi mencionado',
        'Você foi mencionado em um comentário na demanda "' || demand_title || '"',
        'info',
        '/demands/' || NEW.demand_id
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_interaction_mention
AFTER INSERT ON public.demand_interactions
FOR EACH ROW
WHEN (NEW.content IS NOT NULL AND NEW.content LIKE '%@%')
EXECUTE FUNCTION public.notify_mention();

-- Triggers para updated_at
CREATE TRIGGER update_demand_subtasks_updated_at
BEFORE UPDATE ON public.demand_subtasks
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_demand_templates_updated_at
BEFORE UPDATE ON public.demand_templates
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();