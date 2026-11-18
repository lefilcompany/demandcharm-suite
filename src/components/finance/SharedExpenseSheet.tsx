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
import { useFinanceMutation, type OverviewRow } from "@/hooks/useFinance";

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
  const boardName = (id: string) => boards.find((b) => b.id === id)?.name ?? "Quadro";
  const save = useFinanceMutation(async () => {
    const { error } = await supabase.from("finance_expenses").insert({ team_id: teamId, board_id: null, competence: `${sh.month}-01`,
      amount: Number(sh.amount), description: sh.description, expense_type: sh.type, allocation_method: sh.method,
      hours_weight: sh.method === "mixed" ? Number(sh.weight) / 100 : null,
      allocation_pct: sh.method === "revenue_pct" ? Number(sh.pct) : null, allocation_board_ids: sh.only.length ? sh.only : null, created_by: user!.id });
    if (error) throw error;
  });
  const preview = allocate(
    { amount: Number(sh.amount) || 0, method: sh.method, hoursWeight: Number(sh.weight) / 100, pct: Number(sh.pct) || 0, boardIds: sh.only },
    overview.filter((r) => r.competence.substring(0, 7) === sh.month).map((r) => ({ boardId: r.board_id, hours: r.hours_realized, gross: r.gross })),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configurar rateio</SheetTitle>
          <SheetDescription>Lance um gasto da equipe toda e escolha como ele é dividido entre os quadros.</SheetDescription>
        </SheetHeader>
        <form className="mt-4 space-y-4" onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined, {
            onSuccess: () => { toast({ title: "Rateio configurado" }); setSh(blank); onOpenChange(false); },
            onError: (err: any) => toast({ title: String(err?.message).includes("PERIOD_CLOSED") ? "Este mês já foi fechado." : "Não foi possível salvar. Confira os campos.", variant: "destructive" }),
          });
        }}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mês"><MonthField value={sh.month} onChange={(v) => setSh({ ...sh, month: v })} aria-label="Mês" /></Field>
            <Field label="Valor (R$)"><Input type="number" min="0" step="0.01" value={sh.amount} onChange={(e) => setSh({ ...sh, amount: e.target.value })} required /></Field>
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
          <Button type="submit" className="w-full" disabled={save.isPending}>Salvar rateio</Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
