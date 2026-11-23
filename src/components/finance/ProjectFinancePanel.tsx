import { useState } from "react";
import { LineChart, Receipt, Clock, Tag, Settings2 } from "lucide-react";
import { useCanManageFinance, useProjectBoards } from "@/hooks/useProjectFinance";
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

export function ProjectFinancePanel({ projectId, teamId }: { projectId: string; teamId: string | null }) {
  const competence = `${new Date().toISOString().substring(0, 7)}-01`;
  const { data: canManage } = useCanManageFinance(teamId);
  const { isError } = useProjectBoards(teamId);
  const [month, setMonth] = useState(competence.substring(0, 7));
  if (isError) return null;

  return (
    <div className="space-y-4">
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
