import { CurrencyInput } from "@/components/ui/currency-input";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { MonthField } from "@/components/ops/MonthField";
import { OpsLabel } from "@/components/ops/OpsParts";
import { AllocationBar } from "@/components/finance/AllocationBar";
import { allocate, AllocationMethod, EXPENSE_TYPE_LABEL, METHOD_LABEL } from "@/lib/finance/allocation";
import { formatBRL } from "@/lib/finance/engine";
import { useFinanceMutation, useFinanceTable, type OverviewRow } from "@/hooks/useFinance";
import { Pencil } from "lucide-react";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) =>
  <label className="block space-y-1 min-w-0"><span className="text-xs font-medium leading-none">{label}</span>{children}</label>;

/** Creates a shared (team-wide) expense and how it is split between boards. Only rendered for finance managers/owners. */
export function SharedExpenseSheet({ open, onOpenChange, teamId, boards, overview }: {
  open: boolean; onOpenChange: (o: boolean) => void; teamId: string; boards: { id: string; name: string }[]; overview: OverviewRow[];
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const thisMonth = new Date().toISOString().substring(0, 7);
  const blank = { month: thisMonth, amount: "", description: "", type: "fixa", method: "hours" as AllocationMethod, weight: "50", pct: "", only: [] as string[] };
  const [sh, setSh] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const all = useFinanceTable<any>("finance_expenses", teamId, open);
  const configured = (all.data ?? []).filter((e) => !e.board_id && e.allocation_method)
    .sort((a, b) => String(b.competence).localeCompare(String(a.competence)));
  const startEdit = (e: any) => {
    setEditId(e.id);
    setSh({ month: String(e.competence).substring(0, 7), amount: String(Number(e.amount)), description: e.description ?? "", type: e.expense_type ?? "fixa",
      method: e.allocation_method, weight: e.hours_weight != null ? String(Math.round(Number(e.hours_weight) * 100)) : "50",
      pct: e.allocation_pct != null ? String(Number(e.allocation_pct)) : "", only: e.allocation_board_ids ?? [] });
  };
  const reset = () => { setEditId(null); setSh(blank); };
  const ruleText = (e: any) => {
    const m = METHOD_LABEL[e.allocation_method as AllocationMethod] ?? e.allocation_method;
    const extra = e.allocation_method === "revenue_pct" && e.allocation_pct != null ? ` ${Number(e.allocation_pct)}%`
      : e.allocation_method === "mixed" && e.hours_weight != null ? ` (${Math.round(Number(e.hours_weight) * 100)}% horas)` : "";
    const ids: string[] = e.allocation_board_ids ?? [];
    const where = ids.length ? ids.map(boardName).join(", ") : "todos os quadros";
    return `${m}${extra} · ${where}`;
  };
  const boardName = (id: string) => boards.find((b) => b.id === id)?.name ?? "Quadro";
  const save = useFinanceMutation(async () => {
    const row = { competence: `${sh.month}-01`,
      amount: Number(sh.amount), description: sh.description, expense_type: sh.type, allocation_method: sh.method,
      hours_weight: sh.method === "mixed" ? Number(sh.weight) / 100 : null,
      allocation_pct: sh.method === "revenue_pct" ? Number(sh.pct) : null, allocation_board_ids: sh.only.length ? sh.only : null };
    const { error } = editId
      ? await supabase.from("finance_expenses").update(row).eq("id", editId)
      : await supabase.from("finance_expenses").insert({ ...row, team_id: teamId, board_id: null, created_by: user!.id });
    if (error) throw error;
  });
  const preview = allocate(
    { amount: Number(sh.amount) || 0, method: sh.method, hoursWeight: Number(sh.weight) / 100, pct: Number(sh.pct) || 0, boardIds: sh.only },
    overview.filter((r) => r.competence.substring(0, 7) === sh.month).map((r) => ({ boardId: r.board_id, hours: r.hours_realized, gross: r.gross })),
  );

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configurar rateio</SheetTitle>
          <SheetDescription>Lance um gasto da equipe toda e escolha como ele é dividido entre os quadros.</SheetDescription>
        </SheetHeader>
        <section className="mt-4 space-y-2">
          <OpsLabel>Rateios configurados</OpsLabel>
          {all.isLoading ? <p className="text-xs text-muted-foreground">Carregando…</p>
            : !configured.length ? <p className="text-xs text-muted-foreground">Nenhum rateio configurado ainda.</p>
            : <ul className="divide-y rounded-lg border">
              {configured.map((e) => (
                <li key={e.id} className={`flex items-start justify-between gap-2 p-2.5 ${editId === e.id ? "bg-muted" : ""}`}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{e.description}</p>
                    <p className="text-xs text-muted-foreground">{String(e.competence).substring(5, 7)}/{String(e.competence).substring(0, 4)} · {ruleText(e)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-sm tabular-nums font-semibold">{formatBRL(Number(e.amount))}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Editar rateio" onClick={() => startEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                  </div>
                </li>
              ))}
            </ul>}
        </section>
        <div className="mt-5 flex items-center justify-between">
          <OpsLabel>{editId ? "Editando rateio" : "Novo rateio"}</OpsLabel>
          {editId && <Button type="button" size="sm" variant="ghost" onClick={reset}>Cancelar edição</Button>}
        </div>
        <form className="mt-2 space-y-4" onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined, {
            onSuccess: () => { toast({ title: editId ? "Rateio atualizado" : "Rateio configurado" }); reset(); },
            onError: (err: any) => toast({ title: String(err?.message).includes("PERIOD_CLOSED") ? "Este mês já foi fechado." : "Não foi possível salvar. Confira os campos.", variant: "destructive" }),
          });
        }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mês"><MonthField value={sh.month} onChange={(v) => setSh({ ...sh, month: v })} aria-label="Mês" /></Field>
            <Field label="Valor (R$)"><CurrencyInput value={sh.amount} onValueChange={(v) => setSh({ ...sh, amount: v })} required /></Field>
            <div className="col-span-2"><Field label="Descrição"><Input value={sh.description} onChange={(e) => setSh({ ...sh, description: e.target.value })} placeholder="Ex.: aluguel, ferramentas" required /></Field></div>
            <Field label="Tipo"><Select value={sh.type} onValueChange={(v) => setSh({ ...sh, type: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(EXPENSE_TYPE_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Como dividir"><Select value={sh.method} onValueChange={(v) => setSh({ ...sh, method: v as AllocationMethod })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(METHOD_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></Field>
            {sh.method === "revenue_pct" && <Field label="% da receita de cada quadro"><Input type="number" min="0.01" max="100" step="0.01" value={sh.pct} onChange={(e) => setSh({ ...sh, pct: e.target.value })} required /></Field>}
            {sh.method === "mixed" && <Field label="% por horas"><Input type="number" min="0" max="100" step="5" value={sh.weight} onChange={(e) => setSh({ ...sh, weight: e.target.value })} /></Field>}
          </div>
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium">Só entre estes quadros <span className="text-muted-foreground font-normal">(vazio = todos)</span></legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {boards.map((b) => (
                <label key={b.id} className="flex items-center gap-1.5 text-sm">
                  <Checkbox checked={sh.only.includes(b.id)} onCheckedChange={(c) => setSh({ ...sh, only: c ? [...sh.only, b.id] : sh.only.filter((x) => x !== b.id) })} />{b.name}
                </label>
              ))}
            </div>
          </fieldset>
          {Number(sh.amount) > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <OpsLabel>Prévia com os números atuais do mês</OpsLabel>
              <AllocationBar total={Number(sh.amount)} unallocated={preview.unallocated} order={boards.map((b) => b.id)}
                parts={preview.parts.map((p) => ({ key: p.boardId, label: boardName(p.boardId), amount: p.amount }))} />
              <ul className="text-xs flex flex-wrap gap-x-4 tabular-nums">
                {preview.parts.map((p) => <li key={p.boardId}>{boardName(p.boardId)} {formatBRL(p.amount)}</li>)}
                {preview.unallocated > 0 && <li className="text-primary">Não rateado {formatBRL(preview.unallocated)}</li>}
                {preview.surplus > 0 && <li className="text-muted-foreground">Folga {formatBRL(preview.surplus)}</li>}
              </ul>
            </div>
          )}
          <Button type="submit" className="w-full" disabled={save.isPending}>{editId ? "Salvar alterações" : "Salvar rateio"}</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
