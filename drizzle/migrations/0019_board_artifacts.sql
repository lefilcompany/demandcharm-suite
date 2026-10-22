CREATE TABLE public.board_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  sprint_id uuid REFERENCES public.board_sprints(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'doc' CHECK (kind IN ('adr','demand_list','template','report','doc','other')),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  source text NOT NULL DEFAULT 'upload' CHECK (source IN ('upload','authored')),
  file_path text, file_name text, file_size bigint, mime_type text,
  content text,
  is_template boolean NOT NULL DEFAULT false,
  adr_number integer,
  adr_status text CHECK (adr_status IN ('proposed','accepted','superseded','rejected')),
  superseded_by uuid REFERENCES public.board_artifacts(id) ON DELETE SET NULL,
  related_demand_ids uuid[] NOT NULL DEFAULT '{}',
  auto_generated boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_board_artifacts_board ON public.board_artifacts(board_id, sprint_id);
CREATE UNIQUE INDEX uq_board_artifacts_adr_number ON public.board_artifacts(board_id, adr_number) WHERE adr_number IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_artifacts TO authenticated;
GRANT ALL ON public.board_artifacts TO service_role;
ALTER TABLE public.board_artifacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view artifacts" ON public.board_artifacts FOR SELECT TO authenticated
  USING (public.is_board_member((select auth.uid()), board_id));
CREATE POLICY "Executors insert artifacts" ON public.board_artifacts FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_board_sprints((select auth.uid()), board_id) AND created_by = (select auth.uid()));
CREATE POLICY "Executors update artifacts" ON public.board_artifacts FOR UPDATE TO authenticated
  USING (public.can_edit_board_sprints((select auth.uid()), board_id))
  WITH CHECK (public.can_edit_board_sprints((select auth.uid()), board_id));
CREATE POLICY "Executors delete artifacts" ON public.board_artifacts FOR DELETE TO authenticated
  USING (public.can_edit_board_sprints((select auth.uid()), board_id));

CREATE OR REPLACE FUNCTION public.trg_board_artifact_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.sprint_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.board_sprints s WHERE s.id = NEW.sprint_id AND s.board_id = NEW.board_id) THEN
    RAISE EXCEPTION 'A sprint não pertence a este quadro' USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.kind = 'adr' AND NOT NEW.is_template THEN
      PERFORM pg_advisory_xact_lock(hashtext('adr:' || NEW.board_id::text));
      SELECT COALESCE(MAX(adr_number), 0) + 1 INTO NEW.adr_number FROM public.board_artifacts WHERE board_id = NEW.board_id;
      NEW.adr_status := COALESCE(NEW.adr_status, 'proposed');
    ELSE
      NEW.adr_number := NULL;
    END IF;
  ELSE
    NEW.adr_number := OLD.adr_number;
    NEW.board_id := OLD.board_id;
    IF OLD.kind = 'adr' AND OLD.adr_status = 'accepted' AND (
      NEW.content IS DISTINCT FROM OLD.content OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.file_path IS DISTINCT FROM OLD.file_path) THEN
      RAISE EXCEPTION 'ADR aceita não pode ser editada; crie uma nova ADR que a substitua' USING ERRCODE = 'check_violation';
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER board_artifact_rules BEFORE INSERT OR UPDATE ON public.board_artifacts
  FOR EACH ROW EXECUTE FUNCTION public.trg_board_artifact_rules();
REVOKE EXECUTE ON FUNCTION public.trg_board_artifact_rules() FROM anon, public;

CREATE POLICY "Members read sprint artifacts files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'sprint-artifacts' AND public.is_board_member((select auth.uid()), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "Executors upload sprint artifacts files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'sprint-artifacts' AND public.can_edit_board_sprints((select auth.uid()), ((storage.foldername(name))[1])::uuid));
CREATE POLICY "Executors delete sprint artifacts files" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'sprint-artifacts' AND public.can_edit_board_sprints((select auth.uid()), ((storage.foldername(name))[1])::uuid));