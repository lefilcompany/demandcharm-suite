import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonthField } from "@/components/ops/MonthField";
import { OpsLabel } from "@/components/ops/OpsParts";
import { formatBRL } from "@/lib/finance/engine";
import { useFinanceMutation } from "@/hooks/useFinance";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) =>
  <label className="block space-y-1 min-w-0"><span className="text-xs font-medium leading-none">{label}</span>{children}</label>;

/**
 * Monthly revenue launched for one project. Only the amount changes per project:
 * the NF tax rate, margin and allocation always come from the team's values.
 */
export function ProjectRevenue({ projectId, teamId, canManage }: { projectId: string; teamId: string | null; canManage: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const thisMonth = new Date().toISOString().substring(0, 7);
  const [f, setF] = useState({ month: thisMonth, amount: "", description: "" });
  const list = useQuery({
    queryKey: ["finance-table", "project-revenues", projectId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase.from("finance_revenues") as any).select("*").eq("project_id", projectId).order("competence", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
  const add = useFinanceMutation(async () => {
    const { error } = await supabase.from("finance_revenues").insert({
      team_id: teamId!, project_id: projectId, competence: `${f.month}-01`,
      gross_amount: Number(f.amount), description: f.description || null, created_by: user!.id,
    } as any);
    if (error) throw error;
  });
  const del = useFinanceMutation(async (id: string) => {
    const { error } = await supabase.from("finance_revenues").delete().eq("id", id);
    if (error) throw error;
  });
  const fail = (e: any) => toast({ title: String(e?.message).includes("PERIOD_CLOSED") ? "Este mês já foi fechado." : "Não foi possível salvar.", variant: "destructive" });

  return (
    <div className="space-y-4 pt-2">
      {canManage && (
        <form className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end rounded-xl border p-3" onSubmit={(e) => { e.preventDefault();
          add.mutate(undefined, { onSuccess: () => { toast({ title: "Faturamento lançado" }); setF({ ...f, amount: "", description: "" }); list.refetch(); }, onError: fail }); }}>
          <Field label="Mês"><MonthField value={f.month} onChange={(v) => setF({ ...f, month: v })} aria-label="Mês" /></Field>
          <Field label="Valor bruto (R$)"><Input type="number" min="0" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
          <Field label="Descrição"><Input value={f.description} placeholder="Ex.: fee mensal" onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          <Button type="submit" disabled={add.isPending}>Lançar faturamento</Button>
        </form>
      )}
      <section className="space-y-1">
        <OpsLabel>Faturamento do projeto</OpsLabel>
        {!list.data?.length ? <p className="text-sm text-muted-foreground">Nenhum faturamento lançado para este projeto.</p> : (
          <ul className="divide-y rounded-xl border">{list.data.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 p-3 text-sm">
              <span>{String(r.competence).substring(5, 7)}/{String(r.competence).substring(0, 4)} · {r.description || "Faturamento"}</span>
              <span className="flex items-center gap-1"><span className="tabular-nums font-semibold">{formatBRL(Number(r.gross_amount))}</span>
                {canManage && <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Remover faturamento" onClick={() => del.mutate(r.id, { onSuccess: () => list.refetch(), onError: fail })}><Trash2 className="h-3.5 w-3.5" /></Button>}</span>
            </li>))}</ul>
        )}
      </section>
    </div>
  );
}
