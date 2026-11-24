import { CurrencyInput } from "@/components/ui/currency-input";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Info, Pencil, Wrench, Briefcase, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { OpsLabel } from "@/components/ops/OpsParts";
import { formatBRL } from "@/lib/finance/engine";
import { TeamCostsHistory } from "./TeamCostsHistory";
import { useFinanceMutation } from "@/hooks/useFinance";
import { shareAll, TEAM_COST_HINT, TEAM_COST_LABEL, TEAM_COST_TYPES, TeamCostType } from "@/lib/finance/projectShare";

const ICON: Record<TeamCostType, typeof Building2> = { fixa: Building2, operacional: Wrench, administrativa: Briefcase };

/** Team-wide fixed/operational/admin costs (valid until changed) split equally across active projects. */
export function TeamCostsPanel({ teamId, canEdit }: { teamId: string; canEdit: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const month = new Date().toISOString().substring(0, 7);
  const share = useQuery({
    queryKey: ["finance-table", "team-cost-share", teamId, month, user?.id],
    enabled: !!teamId && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_cost_share" as any, { _team_id: teamId, _competence: `${month}-01` });
      if (error) throw error;
      return data as { active_projects: number; projects: { id: string; name: string }[]; fixa: number; operacional: number; administrativa: number };
    },
  });
  const [editing, setEditing] = useState<TeamCostType | null>(null);
  const [value, setValue] = useState("");
  const save = useFinanceMutation(async ({ type, amount }: { type: TeamCostType; amount: number }) => {
    const { error } = await supabase.from("finance_team_costs" as any).upsert(
      { team_id: teamId, cost_type: type, monthly_amount: amount, valid_from: `${month}-01`, created_by: user!.id, updated_by: user!.id, updated_at: new Date().toISOString() },
      { onConflict: "team_id,cost_type,valid_from" });
    if (error) throw error;
  });

  if (share.isLoading) return <Skeleton className="h-64 w-full" />;
  if (share.isError) return <div className="rounded-xl border p-6 text-sm">Não foi possível carregar os custos. <Button size="sm" variant="outline" onClick={() => share.refetch()}>Tentar de novo</Button></div>;
  const d = share.data!;
  const costs = { fixa: Number(d.fixa), operacional: Number(d.operacional), administrativa: Number(d.administrativa) };
  const n = Number(d.active_projects);
  const { parts, totalPerProject } = shareAll(costs, n);
  const total = costs.fixa + costs.operacional + costs.administrativa;

  return (
    <div className="space-y-4">
      {!canEdit && <p className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5" />Somente leitura — só o dono e o gestor financeiro alteram os custos.</p>}
      <div className="grid gap-3 md:grid-cols-3">
        {TEAM_COST_TYPES.map((t) => {
          const Icon = ICON[t];
          const on = editing === t;
          return (
            <article key={t} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                  <div><h3 className="text-sm font-semibold">{TEAM_COST_LABEL[t]}</h3><p className="text-xs text-muted-foreground">{TEAM_COST_HINT[t]}</p></div></div>
                {canEdit && !on && <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={`Editar ${TEAM_COST_LABEL[t]}`} onClick={() => { setEditing(t); setValue(String(costs[t] || "")); }}><Pencil className="h-3.5 w-3.5" /></Button>}
              </div>
              {on ? (
                <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); save.mutate({ type: t, amount: Number(value) || 0 }, {
                  onSuccess: () => { toast({ title: `${TEAM_COST_LABEL[t]} atualizado` }); setEditing(null); share.refetch(); qc.invalidateQueries({ queryKey: ["finance-table", "team-costs-history"] }); },
                  onError: () => toast({ title: "Não foi possível salvar.", variant: "destructive" }) }); }}>
                  <CurrencyInput autoFocus value={value} onValueChange={setValue} aria-label={`Valor mensal de ${TEAM_COST_LABEL[t]}`} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                    <Button type="submit" size="sm" disabled={save.isPending}>Salvar</Button>
                  </div>
                </form>
              ) : (
                <div><OpsLabel>Por mês</OpsLabel><div className="font-ops-display text-2xl font-semibold tabular-nums">{formatBRL(costs[t])}</div></div>
              )}
              <p className="text-xs text-muted-foreground">Vale todo mês até ser trocado.</p>
            </article>
          );
        })}
      </div>

      <section className="rounded-xl bg-ops-ink text-ops-ink-foreground p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><OpsLabel>Rateio por projeto ativo</OpsLabel><div className="font-ops-display text-3xl font-semibold tabular-nums">{formatBRL(totalPerProject)}</div>
            <p className="text-xs opacity-70">{formatBRL(total)} ÷ {n} {n === 1 ? "projeto ativo" : "projetos ativos"}</p></div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm tabular-nums">
            <thead><tr className="text-left text-xs opacity-70"><th className="py-1 font-medium">Custo</th><th className="py-1 font-medium text-right">Total</th><th className="py-1 font-medium text-right">÷ projetos</th><th className="py-1 font-medium text-right">Por projeto</th></tr></thead>
            <tbody>{parts.map((p) => (
              <tr key={p.type} className="border-t border-ops-ink-foreground/10"><td className="py-1.5">{TEAM_COST_LABEL[p.type]}</td><td className="text-right">{formatBRL(p.total)}</td><td className="text-right">{n}</td><td className="text-right font-semibold">{formatBRL(p.perProject)}</td></tr>
            ))}</tbody>
          </table>
        </div>
        {n === 0 ? <p className="text-xs text-primary">Nenhum projeto ativo com gestão financeira: os custos não estão sendo divididos.</p> : (
          <div><OpsLabel>Projetos que dividem os custos</OpsLabel>
            <ul className="mt-1 flex flex-wrap gap-1.5">{d.projects.map((p) => <li key={p.id} className="rounded-full bg-ops-ink-foreground/10 px-2.5 py-0.5 text-xs">{p.name}</li>)}</ul></div>
        )}
      </section>

      <TeamCostsHistory teamId={teamId} />

      <p className="flex items-start gap-2 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        O custo das pessoas (RH) entra pelas horas gastas em cada projeto, usando a hora/homem. Marketing e comercial não entram nos custos dos projetos. Inativar um projeto aumenta a parte dos que continuam ativos a partir daquele mês.</p>
    </div>
  );
}
