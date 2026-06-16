-- Remover política antiga de DELETE
DROP POLICY IF EXISTS "Users can delete own interactions" ON public.demand_interactions;

-- Nova política: apenas comentários podem ser deletados (ajustes são preservados)
CREATE POLICY "Users can delete own comments only"
ON public.demand_interactions
FOR DELETE
USING (
  auth.uid() = user_id 
  AND interaction_type = 'comment'
);

-- Remover política antiga de UPDATE
DROP POLICY IF EXISTS "Users can update own interactions" ON public.demand_interactions;

-- Nova política: apenas comentários podem ser editados (ajustes são imutáveis)
CREATE POLICY "Users can update own comments only"
ON public.demand_interactions
FOR UPDATE
USING (
  auth.uid() = user_id 
  AND interaction_type = 'comment'
);