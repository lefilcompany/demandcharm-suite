import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Landmark } from "lucide-react";
import { useCanManageFinance, useProjectBoards, useFinanceMutation } from "@/hooks/useProjectFinance";
import { ProjectHoursCosts } from "./ProjectHoursCosts";
import { ProjectMinimumPrice } from "./ProjectMinimumPrice";
import { ProjectFinanceSummary, ProjectFinanceSettings } from "./ProjectFinanceSummary";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { FinanceTabsList, FinanceTab } from "@/components/ops/FinanceUI";

const ERR: Record<string, string> = {
  PROJECT_BOARD_OVERLAP: "Esse quadro já está vinculado a este projeto nesse período.",
  PROJECT_BOARD_TEAM_MISMATCH: "O quadro precisa ser da mesma equipe do projeto.",
  PERIOD_CLOSED: "Este mês já foi fechado.",
  INVALID_PROJECT: "Ative o controle financeiro do projeto antes de atribuir demandas.",
};
const msg = (e: any) => Object.entries(ERR).find(([k]) => String(e?.message).includes(k))?.[1] ?? "Não foi possível salvar.";

export function ProjectFinancePanel({ projectId, teamId }: { projectId: string; teamId: string | null }) {
  const { toast } = useToast();
  const competence = `${new Date().toISOString().substring(0, 7)}-01`;
  const { data: canManage } = useCanManageFinance(teamId);
  const { isError } = useProjectBoards(teamId);
  const project = useQuery({
    queryKey: ["project-finance-config", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, finance_enabled").eq("id", projectId).single();
      if (error) throw error;
      return data;
    },
  });
  const [month, setMonth] = useState(competence.substring(0, 7));
  const fail = (e: any) => toast({ title: msg(e), variant: "destructive" });

  const saveCfg = useFinanceMutation(async (v: { finance_enabled?: boolean; unit_external_id?: string | null }) => {
    const { error } = await supabase.from("projects").update(v).eq("id", projectId);
    if (error) throw error;
    await project.refetch();
  });
  if (isError) return null;
  const enabled = !!project.data?.finance_enabled;

  return (
    <section className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Landmark className="h-5 w-5 text-primary" />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold">Base financeira do projeto</h2>
          <p className="text-sm text-muted-foreground">As demandas e quadros do projeto entram automaticamente nos números financeiros.</p>
        </div>
        {canManage && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={enabled} onCheckedChange={(v) => saveCfg.mutate({ finance_enabled: v }, { onError: fail })} />
            Controle financeiro {enabled ? "ativo" : "desligado"}
          </label>
        )}
      </div>

      <Tabs defaultValue="result">
        <FinanceTabsList>
          <FinanceTab value="result">Resultado</FinanceTab>
          <FinanceTab value="hours">Horas e custos</FinanceTab>
          <FinanceTab value="price">Preço mínimo</FinanceTab>
          <FinanceTab value="config">Configuração</FinanceTab>
        </FinanceTabsList>
        <TabsContent value="result"><ProjectFinanceSummary projectId={projectId} month={month} onMonth={setMonth} /></TabsContent>
        <TabsContent value="hours"><ProjectHoursCosts projectId={projectId} canExport={!!canManage} /></TabsContent>
        <TabsContent value="price"><ProjectMinimumPrice teamId={teamId} /></TabsContent>
        <TabsContent value="config"><ProjectFinanceSettings projectId={projectId} canManage={!!canManage} /></TabsContent>
      </Tabs>
    </section>
  );
}
