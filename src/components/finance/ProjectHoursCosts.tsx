import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtHours, hoursCostsCsv, kindLabel, type HoursCostsReport } from "@/lib/finance/timeSlices";

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function useProjectHoursCosts(projectId: string, competence: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["project-hours-costs", projectId, competence, user?.id],
    enabled: !!user && !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_project_hours_costs" as any, { _project_id: projectId, _competence: competence });
      if (error) throw error;
      return data as unknown as HoursCostsReport;
    },
  });
}

export function downloadHoursCsv(r: HoursCostsReport, month: string) {
  const url = URL.createObjectURL(new Blob(["\ufeff" + hoursCostsCsv(r)], { type: "text/csv;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `horas-custos-${month}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

function Chip({ children, warn }: { children: React.ReactNode; warn?: boolean }) {
  return <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs tabular-nums", warn ? "border-primary/40 text-primary" : "text-muted-foreground")}>{children}</span>;
}

/** "Equipe e horas" tab: discreet audit chips + single people table. KPIs live in the project hero. */
export function ProjectHoursCosts({ projectId, month }: { projectId: string; month: string }) {
  const q = useProjectHoursCosts(projectId, `${month}-01`);
  const r = q.data;
  const s = r?.summary;
  if (q.isError && String((q.error as any)?.message).includes("FORBIDDEN")) return null;
  if (q.isError) return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
      <AlertTriangle className="h-4 w-4" />Não foi possível carregar as horas deste mês.
      <Button variant="ghost" size="sm" className="h-7 ml-auto" onClick={() => q.refetch()}><RotateCw className="h-3.5 w-3.5 mr-1" />Tentar de novo</Button>
    </div>
  );
  if (q.isLoading || !r || !s) return <Skeleton className="h-40 w-full rounded-lg" />;

  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap gap-1.5">
        <Chip>{fmtHours(s.internal_hours)} internas · {s.people_count} pessoa(s)</Chip>
        {(s.client_external_hours > 0 || s.contractor_hours > 0) && <Chip>{fmtHours(s.client_external_hours)} externo · {fmtHours(s.contractor_hours)} prestador</Chip>}
        {s.unclassified_hours > 0 && <Chip warn>{fmtHours(s.unclassified_hours)} sem vínculo</Chip>}
        {s.missing_cost_people > 0 && <Chip warn>{s.missing_cost_people} sem custo ({fmtHours(s.missing_cost_hours)})</Chip>}
        {s.pending_hours > 0 && <Chip warn>{fmtHours(s.pending_hours)} na equipe sem projeto</Chip>}
        {r.audit.overlap_entries > 0 && <Chip>{r.audit.overlap_entries} sobreposto(s) · −{fmtHours(r.audit.overlap_hours_removed)}</Chip>}
        {r.audit.split_entries > 0 && <Chip>{r.audit.split_entries} dividido(s) na virada</Chip>}
        {r.audit.running_entries > 0 && <Chip warn>{r.audit.running_entries} timer(s) em andamento</Chip>}
      </div>

      {r.can_see_people ? (
        r.people && r.people.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left font-medium">Pessoa</th>
                  <th className="px-3 py-2 text-left font-medium">Vínculo</th>
                  <th className="px-3 py-2 text-right font-medium">Horas</th>
                  <th className="px-3 py-2 text-right font-medium">Custo/h</th>
                  <th className="px-3 py-2 text-right font-medium">Custo</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {r.people.map((p) => (
                  <tr key={p.user_id}>
                    <td className="px-3 py-2 font-medium truncate max-w-[16rem]">{p.name}</td>
                    <td className={cn("px-3 py-2 text-xs", p.kind ? "text-muted-foreground" : "text-primary")}>{kindLabel(p.kind)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtHours(p.hours)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{p.hourly_cost == null ? "—" : brl(p.hourly_cost)}</td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", p.cost == null && "text-primary font-medium")}>{p.cost == null ? "Sem custo" : brl(p.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-muted-foreground">Nenhuma hora apontada neste projeto no mês.</p>
      ) : <p className="text-xs text-muted-foreground">Valores por pessoa ficam visíveis só para quem tem acesso a custos individuais.</p>}
    </div>
  );
}
