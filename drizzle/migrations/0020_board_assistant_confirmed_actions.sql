CREATE TABLE public.board_agent_action_receipts (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  call_id text NOT NULL,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  action text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, call_id)
);
GRANT SELECT, INSERT ON public.board_agent_action_receipts TO authenticated;
GRANT ALL ON public.board_agent_action_receipts TO service_role;
ALTER TABLE public.board_agent_action_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own assistant receipts" ON public.board_agent_action_receipts FOR SELECT TO authenticated USING(user_id = (select auth.uid()));
CREATE POLICY "Own assistant receipts insert" ON public.board_agent_action_receipts FOR INSERT TO authenticated WITH CHECK(user_id = (select auth.uid()) AND public.can_edit_board_sprints((select auth.uid()), board_id));
CREATE OR REPLACE FUNCTION public.execute_board_agent_action(p_board_id uuid, p_call_id text, p_action text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_user uuid := auth.uid(); v_role text; v_team uuid; v_result jsonb; v_id uuid; v_ids uuid[]; v_d record; v_stage uuid; v_name text; v_responsible uuid; v_service uuid; v_sprint uuid; v_title text; v_description text; v_priority text; v_patch jsonb;
BEGIN
  SELECT role::text INTO v_role FROM public.board_members WHERE board_id=p_board_id AND user_id=v_user;
  IF v_user IS NULL OR v_role IS NULL OR v_role NOT IN ('admin','moderator','executor') THEN RAISE EXCEPTION 'Sem permissão para alterar este quadro'; END IF;
  IF p_call_id IS NULL OR length(p_call_id)>200 THEN RAISE EXCEPTION 'Identificador de ação inválido'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(v_user::text || p_call_id));
  SELECT result INTO v_result FROM public.board_agent_action_receipts WHERE user_id=v_user AND call_id=p_call_id AND board_id=p_board_id AND action=p_action;
  IF FOUND THEN RETURN v_result; END IF;
  SELECT team_id INTO v_team FROM public.boards WHERE id=p_board_id;
  IF p_action='create_follow_up' THEN
    v_id := (p_payload->>'demand_id')::uuid;
    IF NOT EXISTS(SELECT 1 FROM public.demands WHERE id=v_id AND board_id=p_board_id AND NOT archived) THEN RAISE EXCEPTION 'Demanda não encontrada neste quadro'; END IF;
    IF length(btrim(COALESCE(p_payload->>'content','')))=0 OR length(p_payload->>'content')>10000 THEN RAISE EXCEPTION 'Comentário inválido'; END IF;
    INSERT INTO public.demand_interactions(demand_id,user_id,content,interaction_type,channel)
    VALUES(v_id,v_user,p_payload->>'content','comment',CASE WHEN COALESCE((p_payload->>'internal')::boolean,false) THEN 'internal' ELSE 'public' END) RETURNING id INTO v_id;
    v_result := jsonb_build_object('comment_id',v_id,'saved',true);
  ELSIF p_action='apply_sprint_plan' THEN
    SELECT array_agg(value::uuid) INTO v_ids FROM jsonb_array_elements_text(p_payload->'demand_ids');
    IF COALESCE(cardinality(v_ids),0)=0 OR cardinality(v_ids)>50 THEN RAISE EXCEPTION 'Selecione de 1 a 50 demandas'; END IF;
    IF EXISTS(SELECT 1 FROM unnest(v_ids) x WHERE NOT EXISTS(SELECT 1 FROM public.demands d JOIN public.demand_statuses s ON s.id=d.status_id WHERE d.id=x AND d.board_id=p_board_id AND NOT d.archived AND lower(s.name)<>'entregue')) THEN RAISE EXCEPTION 'O plano contém demandas indisponíveis'; END IF;
    v_sprint := (p_payload->>'sprint_id')::uuid;
    IF v_sprint IS NULL THEN
      IF length(btrim(COALESCE(p_payload->>'name','')))=0 OR (p_payload->>'end_date')::date < (p_payload->>'start_date')::date THEN RAISE EXCEPTION 'Nome ou período da sprint inválido'; END IF;
      INSERT INTO public.board_sprints(board_id,name,goal,start_date,end_date,created_by) VALUES(p_board_id,p_payload->>'name',p_payload->>'goal',(p_payload->>'start_date')::date,(p_payload->>'end_date')::date,v_user) RETURNING id INTO v_sprint;
    ELSIF NOT EXISTS(SELECT 1 FROM public.board_sprints WHERE id=v_sprint AND board_id=p_board_id AND status<>'completed') THEN RAISE EXCEPTION 'Sprint indisponível neste quadro'; END IF;
    INSERT INTO public.sprint_demands(sprint_id,demand_id,added_by) SELECT v_sprint,x,v_user FROM unnest(v_ids) x ON CONFLICT(sprint_id,demand_id) DO NOTHING;
    v_result := jsonb_build_object('sprint_id',v_sprint,'demand_ids',v_ids,'saved',true);
  ELSIF p_action IN ('create_demand','update_demand','bulk_update_demands') THEN
    v_patch := CASE WHEN p_action='create_demand' THEN p_payload ELSE p_payload->'patch' END;
    v_stage := (v_patch->>'status_id')::uuid; v_responsible := (v_patch->>'responsible_user_id')::uuid; v_service := (v_patch->>'service_id')::uuid;
    IF v_stage IS NOT NULL THEN
      SELECT s.name INTO v_name FROM public.board_statuses bs JOIN public.demand_statuses s ON s.id=bs.status_id WHERE bs.board_id=p_board_id AND bs.status_id=v_stage AND bs.is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Etapa não ativa neste quadro'; END IF;
    END IF;
    IF v_responsible IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.board_members WHERE board_id=p_board_id AND user_id=v_responsible AND role<>'requester') THEN RAISE EXCEPTION 'Responsável não disponível neste quadro'; END IF;
    IF v_service IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.board_services bs JOIN public.services s ON s.id=bs.service_id WHERE bs.board_id=p_board_id AND bs.service_id=v_service AND s.is_active) THEN RAISE EXCEPTION 'Serviço não disponível neste quadro'; END IF;
    v_title := v_patch->>'title'; v_description := v_patch->>'description'; v_priority := v_patch->>'priority';
    IF v_title IS NOT NULL AND (length(btrim(v_title))=0 OR length(v_title)>500) THEN RAISE EXCEPTION 'Título inválido'; END IF;
    IF v_description IS NOT NULL AND (length(btrim(regexp_replace(v_description,'<[^>]*>','','g')))<20 OR length(v_description)>20000) THEN RAISE EXCEPTION 'Descrição precisa ter pelo menos 20 caracteres'; END IF;
    IF v_priority IS NOT NULL AND v_priority NOT IN ('urgente','alta','média','baixa') THEN RAISE EXCEPTION 'Prioridade inválida'; END IF;
    IF p_action='create_demand' THEN
      IF v_title IS NULL OR v_description IS NULL OR v_responsible IS NULL THEN RAISE EXCEPTION 'Informe título, descrição e responsável'; END IF;
      IF v_service IS NULL AND EXISTS(SELECT 1 FROM public.board_services WHERE board_id=p_board_id) THEN RAISE EXCEPTION 'Escolha um serviço do quadro'; END IF;
      IF v_stage IS NULL THEN SELECT bs.status_id INTO v_stage FROM public.board_statuses bs JOIN public.demand_statuses s ON s.id=bs.status_id WHERE bs.board_id=p_board_id AND bs.is_active AND lower(s.name) NOT IN ('entregue','fazendo','ajuste','em ajuste') ORDER BY bs.position LIMIT 1; END IF;
      IF v_stage IS NULL THEN RAISE EXCEPTION 'Não há etapa inicial disponível'; END IF;
      INSERT INTO public.demands(board_id,team_id,title,description,status_id,priority,service_id,due_date,assigned_to,created_by,effort_points)
      VALUES(p_board_id,v_team,v_title,v_description,v_stage,COALESCE(v_priority,'média'),v_service,(v_patch->>'due_date')::timestamptz,v_responsible,v_user,(v_patch->>'effort_points')::integer) RETURNING id INTO v_id;
      INSERT INTO public.demand_assignees(demand_id,user_id,is_primary) VALUES(v_id,v_responsible,true) ON CONFLICT(demand_id,user_id) DO UPDATE SET is_primary=true;
      v_ids := ARRAY[v_id];
    ELSE
      IF p_action='update_demand' THEN v_ids := ARRAY[(p_payload->>'demand_id')::uuid]; ELSE SELECT array_agg(value::uuid) INTO v_ids FROM jsonb_array_elements_text(p_payload->'demand_ids'); END IF;
      IF COALESCE(cardinality(v_ids),0)=0 OR cardinality(v_ids)>50 THEN RAISE EXCEPTION 'Selecione de 1 a 50 demandas'; END IF;
      FOR v_id IN SELECT DISTINCT unnest(v_ids) LOOP
        SELECT d.*,s.name stage INTO v_d FROM public.demands d JOIN public.demand_statuses s ON s.id=d.status_id WHERE d.id=v_id AND d.board_id=p_board_id AND NOT d.archived FOR UPDATE OF d;
        IF NOT FOUND THEN RAISE EXCEPTION 'Demanda não encontrada neste quadro'; END IF;
        IF lower(v_d.stage)='entregue' THEN RAISE EXCEPTION 'Demandas entregues não podem ser editadas'; END IF;
        IF v_role='executor' AND NOT EXISTS(SELECT 1 FROM public.demand_assignees WHERE demand_id=v_id AND user_id=v_user) AND v_d.created_by<>v_user AND v_d.assigned_to IS DISTINCT FROM v_user THEN RAISE EXCEPTION 'Você não executa esta demanda'; END IF;
        IF v_responsible IS NOT NULL THEN
          UPDATE public.demand_assignees SET is_primary=false WHERE demand_id=v_id AND is_primary;
          INSERT INTO public.demand_assignees(demand_id,user_id,is_primary) VALUES(v_id,v_responsible,true) ON CONFLICT(demand_id,user_id) DO UPDATE SET is_primary=true;
        END IF;
        IF v_patch->>'due_date' IS NOT NULL AND (v_patch->>'due_date')::timestamptz IS DISTINCT FROM v_d.due_date THEN
          IF length(btrim(COALESCE(p_payload->>'reason','')))<3 THEN RAISE EXCEPTION 'Informe a justificativa da mudança de prazo'; END IF;
          PERFORM public.reschedule_demand(v_id,(v_patch->>'due_date')::timestamptz,p_payload->>'reason');
        END IF;
        UPDATE public.demands SET title=COALESCE(v_title,title),description=COALESCE(v_description,description),priority=COALESCE(v_priority,priority),service_id=COALESCE(v_service,service_id),assigned_to=COALESCE(v_responsible,assigned_to),status_id=COALESCE(v_stage,status_id),status_changed_at=CASE WHEN v_stage IS NOT NULL AND v_stage<>status_id THEN now() ELSE status_changed_at END,status_changed_by=CASE WHEN v_stage IS NOT NULL AND v_stage<>status_id THEN v_user ELSE status_changed_by END WHERE id=v_id;
      END LOOP;
    END IF;
    v_result := jsonb_build_object('demand_ids',v_ids,'saved',true);
  ELSE RAISE EXCEPTION 'Ação desconhecida'; END IF;
  INSERT INTO public.board_agent_action_receipts(user_id,call_id,board_id,action,result) VALUES(v_user,p_call_id,p_board_id,p_action,v_result);
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION public.execute_board_agent_action(uuid,text,text,jsonb) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.execute_board_agent_action(uuid,text,text,jsonb) TO authenticated;
