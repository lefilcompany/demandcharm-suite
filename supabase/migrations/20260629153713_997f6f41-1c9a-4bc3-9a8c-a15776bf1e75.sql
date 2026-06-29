DELETE FROM public.user_board_ai_insights
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(insights::jsonb) AS ins
  WHERE COALESCE(ins->>'description','') = ''
     OR length(ins->>'description') < 20
     OR rtrim(ins->>'description') LIKE '%(' 
     OR rtrim(ins->>'description') LIKE '%,'
);