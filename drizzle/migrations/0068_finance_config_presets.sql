CREATE TABLE public.finance_config_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  description text,
  tax_rate numeric NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate < 1),
  variable_rate numeric NOT NULL DEFAULT 0 CHECK (variable_rate >= 0 AND variable_rate < 1),
  margin_target numeric NOT NULL DEFAULT 0 CHECK (margin_target >= 0 AND margin_target < 1),
  max_discount numeric NOT NULL DEFAULT 0 CHECK (max_discount >= 0 AND max_discount < 1),
  is_default boolean NOT NULL DEFAULT false,
  archived_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_config_presets TO authenticated;
GRANT ALL ON public.finance_config_presets TO service_role;
ALTER TABLE public.finance_config_presets ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX finance_config_presets_one_default ON public.finance_config_presets(team_id) WHERE is_default AND archived_at IS NULL;
CREATE INDEX finance_config_presets_team ON public.finance_config_presets(team_id);

CREATE POLICY "presets read" ON public.finance_config_presets FOR SELECT TO authenticated
  USING (public.can_read_finance_structure((select auth.uid()), team_id) OR public.has_finance_permission((select auth.uid()), 'finance.view_project', team_id, NULL) OR public.is_team_owner((select auth.uid()), team_id));
CREATE POLICY "presets insert" ON public.finance_config_presets FOR INSERT TO authenticated
  WITH CHECK (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL));
CREATE POLICY "presets update" ON public.finance_config_presets FOR UPDATE TO authenticated
  USING (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL))
  WITH CHECK (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL));
CREATE POLICY "presets delete" ON public.finance_config_presets FOR DELETE TO authenticated
  USING (public.has_finance_permission((select auth.uid()), 'finance.manage_settings', team_id, NULL));

ALTER TABLE public.projects ADD COLUMN finance_preset_id uuid REFERENCES public.finance_config_presets(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.finance_seed_project_from_preset()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pr public.finance_config_presets;
BEGIN
  IF NEW.finance_preset_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO pr FROM public.finance_config_presets WHERE id = NEW.finance_preset_id AND team_id = NEW.team_id;
  IF pr.id IS NULL THEN RAISE EXCEPTION 'INVALID_PRESET'; END IF;
  INSERT INTO public.finance_project_settings(project_id, team_id, valid_from, tax_rate, variable_rate, margin_target, created_by)
  VALUES (NEW.id, NEW.team_id, date_trunc('month', current_date)::date, pr.tax_rate, pr.variable_rate, pr.margin_target, auth.uid())
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.finance_seed_project_from_preset() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_project_seed_from_preset AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.finance_seed_project_from_preset();

INSERT INTO public.finance_config_presets(team_id, name, description, tax_rate, variable_rate, margin_target, max_discount, is_default)
SELECT DISTINCT ON (team_id) team_id, 'Padrão', 'Criado a partir dos valores padrão da equipe', tax_rate, variable_rate, margin_target, max_discount, true
FROM public.finance_team_defaults ORDER BY team_id, valid_from DESC;