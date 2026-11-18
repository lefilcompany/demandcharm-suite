import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthField } from "@/components/ops/MonthField";
import { OpsLabel } from "@/components/ops/OpsParts";
import { formatBRL } from "@/lib/finance/engine";
import { useFinanceMutation } from "@/hooks/useFinance";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) =>
  <label className="block space-y-1 min-w-0"><span className="text-xs font-medium leading-none">{label}</span>{children}</label>;

/** Monthly revenue launched for one project (stored with one of the project's boards for permissions/history). */
export function ProjectRevenue({ projectId, teamId, canManage }: { projectId: string; teamId: string | null; canManage: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const thisMonth = new Date().toISOString().substring(0, 7);
  const [f, setF] = useState({ month: thisMonth, amount: "", tax: "", description: "", board: "" });
  const boards = useQuery({
    queryKey: ["project-finance", "boards", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("project_boards").select("board_id, boards(name)").eq("project_id", projectId).is("valid_to", null);
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ id: r.board_id as string, name: (r.boards?.name ?? "Quadro") as string }));
    },
  });
  const list = useQuery({
    queryKey: ["finance-table", "project-revenues", projectId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase.from("finance_revenues") as any).select("*").eq("project_id", projectId).order("competence", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
  const board = f.board || boards.data?.[0]?.id || "";
  const add = useFinanceMutation(async () => {
    const { error } = await supabase.from("finance_revenues").insert({ team_id: teamId!, board_id: board, project_id: projectId, competence: `${f.month}-01`,
      gross_amount: Number(f.amount), tax_rate: f.tax ? Number(f.tax) / 100 : null, description: f.description || null, created_by: user!.id } as any);
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
        boards.data && boards.data.length === 0 ? <p className="text-sm text-muted-foreground">Adicione uma demanda ou quadro ao projeto para lançar o faturamento.</p> :
        <form className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end rounded-xl border p-3" onSubmit={(e) => { e.preventDefault();
          add.mutate(undefined, { onSuccess: () => { toast({ title: "Faturamento lançado" }); setF({ ...f, amount: "", description: "" }); list.refetch(); }, onError: fail }); }}>
          <Field label="Mês"><MonthField value={f.month} onChange={(v) => setF({ ...f, month: v })} aria-label="Mês" /></Field>
          <Field label="Valor bruto (R$)"><Input type="number" min="0" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
          <Field label="Imposto NF %"><Input type="number" min="0" max="99" step="0.01" placeholder="padrão" value={f.tax} onChange={(e) => setF({ ...f, tax: e.target.value })} /></Field>
          <Field label="Descrição"><Input value={f.description} placeholder="Ex.: fee mensal" onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
          {(boards.data?.length ?? 0) > 1 ? (
            <Field label="Quadro de referência"><Select value={board} onValueChange={(v) => setF({ ...f, board: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{boards.data!.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></Field>
          ) : <Button type="submit" disabled={!board || add.isPending}>Lançar</Button>}
          {(boards.data?.length ?? 0) > 1 && <Button type="submit" className="col-span-2 sm:col-span-5" disabled={!board || add.isPending}>Lançar faturamento</Button>}
        </form>
      )}
      <section className="space-y-1">
        <OpsLabel>Faturamento do projeto</OpsLabel>
        {!list.data?.length ? <p className="text-sm text-muted-foreground">Nenhum faturamento lançado para este projeto.</p> : (
          <ul className="divide-y rounded-xl border">{list.data.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 p-3 text-sm">
              <span>{String(r.competence).substring(5, 7)}/{String(r.competence).substring(0, 4)} · {r.description || "Faturamento"}{r.tax_rate != null ? ` · NF ${Number(r.tax_rate) * 100}%` : ""}</span>
              <span className="flex items-center gap-1"><span className="tabular-nums font-semibold">{formatBRL(Number(r.gross_amount))}</span>
                {canManage && <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Remover faturamento" onClick={() => del.mutate(r.id, { onSuccess: () => list.refetch(), onError: fail })}><Trash2 className="h-3.5 w-3.5" /></Button>}</span>
            </li>))}</ul>
        )}
      </section>
    </div>
  );
}
