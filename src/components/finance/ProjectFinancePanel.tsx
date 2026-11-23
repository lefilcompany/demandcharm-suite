import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Landmark, LineChart, Receipt, Clock, Tag, Settings2 } from "lucide-react";
import { useCanManageFinance, useProjectBoards, useFinanceMutation } from "@/hooks/useProjectFinance";
import { ProjectHoursCosts } from "./ProjectHoursCosts";
import { ProjectRevenue } from "./ProjectRevenue";
import { ProjectMinimumPrice } from "./ProjectMinimumPrice";
import { ProjectFinanceSummary, ProjectFinanceSettings } from "./ProjectFinanceSummary";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SECTIONS = [
  { v: "result", label: "Resultado", hint: "Lucro e margem do mês", icon: LineChart },
  { v: "revenue", label: "Faturamento", hint: "Contratos do projeto", icon: Receipt },
  { v: "hours", label: "Horas e custos", hint: "Tempo apontado × custo", icon: Clock },
  { v: "price", label: "Preço mínimo", hint: "Quanto cobrar", icon: Tag },
  { v: "config", label: "Configuração", hint: "Valores da equipe", icon: Settings2 },
] as const;

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
    <div className="space-y-4">
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

      <Tabs defaultValue="result" orientation="vertical" className="grid gap-4 lg:grid-cols-[13rem_minmax(0,1fr)]">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0 lg:flex-col lg:items-stretch lg:border-r lg:pr-3">
          {SECTIONS.map(({ v, label, hint, icon: Icon }) => (
            <TabsTrigger key={v} value={v}
              className="group shrink-0 justify-start gap-2.5 rounded-lg px-2.5 py-2 text-left font-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground data-[state=active]:bg-primary/10 data-[state=active]:text-foreground data-[state=active]:shadow-none">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border bg-background group-data-[state=active]:border-primary/40 group-data-[state=active]:text-primary"><Icon className="h-3.5 w-3.5" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-tight">{label}</span>
                <span className="hidden text-[11px] leading-tight text-muted-foreground lg:block">{hint}</span>
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="min-w-0">
          <TabsContent value="result" className="mt-0"><ProjectFinanceSummary projectId={projectId} month={month} onMonth={setMonth} /></TabsContent>
          <TabsContent value="revenue" className="mt-0"><ProjectRevenue projectId={projectId} teamId={teamId} canManage={!!canManage} /></TabsContent>
          <TabsContent value="hours" className="mt-0"><ProjectHoursCosts projectId={projectId} canExport={!!canManage} /></TabsContent>
          <TabsContent value="price" className="mt-0"><ProjectMinimumPrice teamId={teamId} /></TabsContent>
          <TabsContent value="config" className="mt-0"><ProjectFinanceSettings projectId={projectId} canManage={!!canManage} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
