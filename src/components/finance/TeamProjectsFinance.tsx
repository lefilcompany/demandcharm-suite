import { useQuery } from "@tanstack/react-query";
import { Lock, RotateCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatBRL, formatPct, STATUS_LABEL } from "@/lib/finance/engine";
import { projectResult, type ProjectMonth } from "@/lib/finance/projectRollup";
import { DeviationTag } from "./MarginRuler";

interface TeamProject { project_id: string; name: string; months: ProjectMonth[] }

export function TeamProjectsFinance({ teamId, from, to }: { teamId: string | null; from: string; to: string }) {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["team-projects-finance", teamId, from, to, user?.id],
    enabled: !!user && !!teamId && from <= to,
    retry: (n, e: any) => !String(e?.message).includes("FORBIDDEN") && n < 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_projects_finance", { _team_id: teamId!, _from: `${from}-01`, _to: `${to}-01` });
      if (error) throw error;
      return (data ?? []) as unknown as TeamProject[];
    },
  });

  if (q.isError && String((q.error as any)?.message).includes("FORBIDDEN"))
    return <p className="text-sm text-muted-foreground p-4">Você ainda não tem acesso aos números por projeto.</p>;
  if (q.isError)
    return (
      <div className="rounded-xl border p-6 text-center space-y-2">
        <p className="text-sm">Não foi possível carregar os projetos.</p>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}><RotateCw className="h-4 w-4 mr-1" />Tentar de novo</Button>
      </div>
    );

  const rows = (q.data ?? []).map((p) => {
    const r = projectResult(p.months);
    const closed = p.months.length > 0 && p.months.every((m) => m.period_status !== "open");
    const incomplete = r.totals.hoursWithoutCost > 0;
    return { ...p, r, closed, incomplete };
  });

  return (
    <div className="rounded-xl border bg-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            {["Projeto", "Bruto", "Líquida", "Equipe", "Diretas + variáveis", "Rateio", "Custo total", "Resultado", "Margem", "Desvio", "Status"].map((h, i) => (
              <th key={h} className={cn("px-3 py-2 font-medium whitespace-nowrap", i === 0 ? "text-left" : "text-right")}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {q.isLoading && <tr><td colSpan={11} className="p-4"><Skeleton className="h-24 w-full" /></td></tr>}
          {!q.isLoading && rows.length === 0 && (
            <tr><td colSpan={11} className="p-6 text-center text-muted-foreground">Nenhum projeto com controle financeiro ligado nesta equipe.</td></tr>
          )}
          {rows.map(({ project_id, name, r, closed, incomplete }) => (
            <tr key={project_id}>
              <td className="px-3 py-2 font-medium whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">{name}{closed && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Período fechado" />}</span>
                {incomplete && <span className="block text-xs text-primary">Custo incompleto: horas sem custo/hora</span>}
              </td>
              {[r.totals.gross, r.netRevenue, r.totals.teamCost, r.totals.direct + r.totals.variable, r.totals.fixed + r.totals.operational + r.totals.admin, r.totalCost].map((v, i) => (
                <td key={i} className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatBRL(v)}</td>
              ))}
              <td className={cn("px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium", r.result < 0 && "text-destructive")}>{formatBRL(r.result)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatPct(r.margin)}</td>
              <td className="px-3 py-2 text-right"><DeviationTag margin={r.margin} target={r.totals.marginTarget} /></td>
              <td className="px-3 py-2 text-right whitespace-nowrap text-xs">{STATUS_LABEL[r.status]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
