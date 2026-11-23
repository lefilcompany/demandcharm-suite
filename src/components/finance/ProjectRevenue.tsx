import { CurrencyInput } from "@/components/ui/currency-input";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OpsLabel } from "@/components/ops/OpsParts";
import { formatBRL } from "@/lib/finance/engine";
import { useFinanceMutation } from "@/hooks/useFinance";
import { splitContract, contractEnd, periodValue, unitLabel, type ContractUnit } from "@/lib/finance/revenueContract";
import { cn } from "@/lib/utils";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) =>
  <label className="block space-y-1 min-w-0"><span className="text-xs font-medium leading-none">{label}</span>{children}</label>;

const UNITS: { v: ContractUnit; label: string }[] = [{ v: "days", label: "Dias" }, { v: "months", label: "Meses" }, { v: "years", label: "Anos" }];
const br = (iso: string) => `${iso.substring(8, 10)}/${iso.substring(5, 7)}/${iso.substring(0, 4)}`;
const mm = (iso: string) => `${iso.substring(5, 7)}/${iso.substring(2, 4)}`;

/**
 * Contract revenue for one project: total value + duration (days, months or years),
 * stored as monthly installments so every finance number keeps summing per month.
 * Tax rate, margin and allocation always come from the team's values.
 */
export function ProjectRevenue({ projectId, teamId, canManage }: { projectId: string; teamId: string | null; canManage: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const today = new Date().toISOString().substring(0, 10);
  const [f, setF] = useState({ start: today, total: "", duration: "1", unit: "months" as ContractUnit, description: "" });
  const dur = Math.max(0, Math.floor(Number(f.duration) || 0));
  const total = Number(f.total) || 0;
  const plan = useMemo(() => (f.start ? splitContract(total, f.start, dur, f.unit) : []), [total, f.start, dur, f.unit]);

  const list = useQuery({
    queryKey: ["finance-table", "project-revenues", projectId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase.from("finance_revenues") as any).select("*").eq("project_id", projectId).order("competence", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });
  const groups = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const r of list.data ?? []) { const k = r.contract_id ?? `single:${r.id}`; m.set(k, [...(m.get(k) ?? []), r]); }
    return [...m.entries()].map(([key, rows]) => ({ key, rows, head: rows[0] }))
      .sort((a, b) => String(b.head.contract_start ?? b.head.competence).localeCompare(String(a.head.contract_start ?? a.head.competence)));
  }, [list.data]);

  const add = useFinanceMutation(async () => {
    if (!plan.length) throw new Error("INVALID");
    const contractId = crypto.randomUUID();
    const rows = plan.map((p) => ({
      team_id: teamId!, project_id: projectId, competence: p.competence, gross_amount: p.amount,
      description: f.description || null, created_by: user!.id, contract_id: contractId,
      contract_total: total, contract_start: f.start, contract_duration: dur, contract_unit: f.unit,
    }));
    const { error } = await supabase.from("finance_revenues").insert(rows as any);
    if (error) throw error;
  });
  const del = useFinanceMutation(async (key: string) => {
    const q = supabase.from("finance_revenues").delete();
    const { error } = key.startsWith("single:") ? await q.eq("id", key.slice(7)) : await q.eq("contract_id", key);
    if (error) throw error;
  });
  const fail = (e: any) => toast({ title: String(e?.message).includes("PERIOD_CLOSED") ? "Há mês já fechado neste contrato; ele não pode ser alterado." : "Não foi possível salvar.", variant: "destructive" });

  return (
    <div className="space-y-4 pt-2">
      {canManage && (
        <form className="grid overflow-hidden rounded-xl border lg:grid-cols-[minmax(0,1fr)_17rem]" onSubmit={(e) => { e.preventDefault();
          add.mutate(undefined, { onSuccess: () => { toast({ title: "Contrato lançado" }); setF({ ...f, total: "", description: "" }); list.refetch(); }, onError: fail }); }}>
          <div className="space-y-4 p-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Novo contrato</p>
              <Field label=""><CurrencyInput value={f.total} onValueChange={(v) => setF({ ...f, total: v })} required aria-label="Valor total do contrato" className="h-12 [&_input]:text-2xl" /></Field>
              <p className="mt-1 text-[11px] text-muted-foreground">Valor total do contrato, antes do imposto da equipe.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Durante</span>
              <Input type="number" min={1} step={1} value={f.duration} required aria-label="Duração" onChange={(e) => setF({ ...f, duration: e.target.value })} className="h-9 w-20 text-center font-semibold tabular-nums" />
              <div role="radiogroup" aria-label="Contar em" className="inline-flex h-9 rounded-md border bg-muted/40 p-0.5">
                {UNITS.map((u) => (
                  <button key={u.v} type="button" role="radio" aria-checked={f.unit === u.v} onClick={() => setF({ ...f, unit: u.v })}
                    className={cn("rounded-[5px] px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      f.unit === u.v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{u.label}</button>
                ))}
              </div>
              <span className="text-muted-foreground">a partir de</span>
              <Input type="date" value={f.start} required aria-label="Início" onChange={(e) => setF({ ...f, start: e.target.value })} className="h-9 w-40" />
            </div>
            <Field label="Descrição"><Input value={f.description} placeholder="Ex.: contrato de manutenção" onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          </div>

          <aside className="flex flex-col gap-3 border-t bg-muted/30 p-4 lg:border-l lg:border-t-0">
            <p className="text-xs font-medium text-muted-foreground">Como vai entrar no financeiro</p>
            {plan.length ? (<>
              <div>
                <p className="text-2xl font-semibold tabular-nums leading-none">{formatBRL(periodValue(total, dur))}</p>
                <p className="mt-1 text-xs text-muted-foreground">por {unitLabel(f.unit, 1)} · até {br(contractEnd(f.start, dur, f.unit))}</p>
              </div>
              <div className="flex h-16 items-end gap-px" aria-label="Valor de cada mês">
                {(() => { const max = Math.max(...plan.map((p) => p.amount)); return plan.slice(0, 36).map((p) => (
                  <div key={p.competence} title={`${mm(p.competence)} · ${formatBRL(p.amount)}`} className="min-w-[3px] flex-1 rounded-t-sm bg-primary/70" style={{ height: `${Math.max(8, (p.amount / max) * 100)}%` }} />)); })()}
              </div>
              <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted-foreground"><span>{mm(plan[0].competence)}</span><span>{plan.length} {plan.length === 1 ? "mês" : "meses"}</span><span>{mm(plan[plan.length - 1].competence)}</span></div>
              <p className="text-[11px] text-muted-foreground">{f.unit === "days" ? "Dividido pelos dias; cada mês recebe os dias que caem nele." : "Dividido igualmente e lançado mês a mês."}</p>
            </>) : <p className="text-sm text-muted-foreground">Informe o valor e a duração para ver a divisão por mês.</p>}
            <Button type="submit" className="mt-auto w-full" disabled={add.isPending || !plan.length}>Lançar contrato</Button>
          </aside>
        </form>
      )}
      <section className="space-y-1">
        <OpsLabel>Faturamento do projeto</OpsLabel>
        {!groups.length ? <p className="text-sm text-muted-foreground">Nenhum faturamento lançado para este projeto.</p> : (
          <ul className="divide-y rounded-xl border">{groups.map(({ key, rows, head }) => {
            const isContract = !!head.contract_id;
            const sum = rows.reduce((s, r) => s + Number(r.gross_amount), 0);
            return (
              <li key={key} className="flex items-center justify-between gap-2 p-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{head.description || "Faturamento"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {isContract
                      ? `${head.contract_duration} ${unitLabel(head.contract_unit, head.contract_duration)} · ${br(head.contract_start)} até ${br(contractEnd(head.contract_start, head.contract_duration, head.contract_unit))} · ${rows.length} ${rows.length === 1 ? "mês" : "meses"}`
                      : `${mm(String(head.competence))} · lançamento mensal`}
                  </span>
                  {isContract && rows.length > 1 && (() => { const now = new Date().toISOString().substring(0, 7); const done = rows.filter((r) => String(r.competence).substring(0, 7) <= now).length; return (
                    <span className="mt-1.5 flex h-1 w-40 max-w-full overflow-hidden rounded-full bg-muted" title={`${done} de ${rows.length} meses`}><span className="bg-primary" style={{ width: `${(done / rows.length) * 100}%` }} /></span>); })()}
                </span>
                <span className="flex items-center gap-1 shrink-0"><span className="tabular-nums font-semibold">{formatBRL(isContract ? Number(head.contract_total) : sum)}</span>
                  {canManage && <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Remover faturamento" onClick={() => del.mutate(key, { onSuccess: () => list.refetch(), onError: fail })}><Trash2 className="h-3.5 w-3.5" /></Button>}</span>
              </li>);
          })}</ul>
        )}
      </section>
    </div>
  );
}
