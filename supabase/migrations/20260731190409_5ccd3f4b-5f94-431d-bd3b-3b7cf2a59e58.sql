ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS board_id uuid NULL REFERENCES public.boards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_team_board ON public.projects (team_id, board_id);

UPDATE public.projects p
SET board_id = sub.board_id
FROM (
  SELECT pd.project_id, d.board_id, COUNT(*) AS cnt,
         ROW_NUMBER() OVER (PARTITION BY pd.project_id ORDER BY COUNT(*) DESC, d.board_id) AS rn
  FROM public.project_demands pd
  JOIN public.demands d ON d.id = pd.demand_id
  GROUP BY pd.project_id, d.board_id
) sub
WHERE sub.project_id = p.id AND sub.rn = 1 AND p.board_id IS NULL;