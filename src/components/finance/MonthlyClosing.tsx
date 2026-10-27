import { useMemo, useState } from "react";
import { CheckCircle2, Download, Lock, RefreshCw, TriangleAlert, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FinancePermission, useClosingHistory, useClosingPreview, useInvalidateFinance } from "@/hooks/useFinance";
import { computeFinance, formatBRL, formatPct } from "@/lib/finance/engine";
import { ADJUSTMENT_LABEL, AdjustmentTarget, CHECKLIST_TEXT, blockingItems, canClose, monthEnded, normalizeChecklist } from "@/lib/finance/closing";
import { OpsLabel } from "@/components/ops/OpsParts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Props {
  teamId: string;
  boards: { id: string; name: string }[];
  members: { user_id: string; name: string }[];
  can: (p: FinancePermission, boardId?: string) => boolean;
}

const prevMonth = () => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); return d.toISOString().substring(0, 7); };
const monthName = (m: string) => new Date(Number(m.substring(0, 4)), Number(m.substring(5, 7)) - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
const dt = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

const ERRORS: Record<string, string> = {
  CHECKLIST_BLOCKED: "Ainda há pendências que bloqueiam o fechamento.",
  PERIOD_ALREADY_CLOSED: "Este mês já foi fechado.",
  PERIOD_NOT_ENDED: "Só é possível fechar meses que já terminaram.",
  FORBIDDEN: "Você não tem permissão para esta ação.",
};
const errText = (e: any) => Object.entries(ERRORS).find(([k]) => String(e?.message ?? "").includes(k))?.[1] ?? "Não foi possível concluir. Tente novamente.";

export function MonthlyClosing({ teamId, boards, members, can }: Props) {
  const { toast } = useToast();
  const invalidate = useInvalidateFinance();
  const [month, setMonth] = useState(prevMonth());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [adj, setAdj] = useState<{ board: string; target: AdjustmentTarget; amount: string; reason: string }>({ board: "", target: "gross", amount: "", reason: "" });

  const canCloseMonth = can("finance.close_period");
  const preview = useClosingPreview(teamId, month, canCloseMonth);
  const history = useClosingHistory(teamId, true);
  const period = (history.data?.periods ?? []).find((p) => p.competence.substring(0, 7) === month) ?? null;
  const items = useMemo(() => normalizeChecklist(preview.data?.checklist), [preview.data]);
  const blocked = blockingItems(items);
  const ended = monthEnded(month, new Date());
  const nameOf = (id: string) => members.find((m) => m.user_id === id)?.name ?? "Usuário";
  const boardName = (id: string) => boards.find((b) => b.id === id)?.name ?? "Quadro";
  const periodAdjustments = (history.data?.adjustments ?? []).filter((a) => a.period_id === period?.id);

  const sim = useMemo(() => (preview.data?.rows ?? []).map((r) => ({
    ...r, ...computeFinance({ gross: r.gross, tax: r.tax, teamCost: r.team_cost, directExpenses: r.direct_expenses, operationalAlloc: r.allocated_expenses, marginTarget: r.margin_target }),
  })).filter((r) => r.gross || r.totalCost), [preview.data]);
  const simTotal = sim.reduce((a, r) => ({ gross: a.gross + r.gross, result: a.result + r.result }), { gross: 0, result: 0 });

  const close = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("finance_close_period", { _team_id: teamId, _month: `${month}-01` });
    setBusy(false);
    if (error) return toast({ title: errText(error), variant: "destructive" });
    setConfirmOpen(false); setTyped(""); invalidate();
    toast({ title: `${monthName(month)} fechado`, description: "Os números deste mês agora vêm da fotografia guardada." });
  };

  const addAdjustment = async () => {
    if (!period) return;
    const amount = Number(adj.amount.replace(/\./g, "").replace(",", "."));
    if (!adj.board || !amount || adj.reason.trim().length < 5) return toast({ title: "Informe quadro, valor e um motivo com pelo menos 5 caracteres.", variant: "destructive" });
    setBusy(true);
    const { error } = await supabase.rpc("finance_add_adjustment", { _period_id: period.id, _board_id: adj.board, _target: adj.target, _amount: amount, _reason: adj.reason });
    setBusy(false);
    if (error) return toast({ title: errText(error), variant: "destructive" });
    setAdj({ board: "", target: "gross", amount: "", reason: "" }); invalidate();
    toast({ title: "Ajuste registrado", description: "O valor fechado original continua guardado." });
  };

  const adjBoards = boards.filter((b) => can(adj.target === "gross" || adj.target === "tax" ? "finance.manage_revenue" : "finance.manage_expenses", b.id));

  const exportCsv = () => {
    const head = ["Mês", "Evento", "Quadro", "Campo", "Valor", "Motivo", "Autor", "Data"];
    const lines: (string | number)[][] = [];
    for (const p of history.data?.periods ?? []) {
      lines.push([p.competence.substring(0, 7), "Fechamento", "", "Faturamento bruto", Number(p.totals?.gross ?? 0), "", nameOf(p.closed_by), dt(p.closed_at)]);
      for (const a of (history.data?.adjustments ?? []).filter((x) => x.period_id === p.id))
        lines.push([p.competence.substring(0, 7), "Ajuste", boardName(a.board_id), ADJUSTMENT_LABEL[a.target as AdjustmentTarget], a.amount, a.reason.replace(/[;\n]/g, " "), nameOf(a.created_by), dt(a.created_at)]);
    }
    const blob = new Blob(["\ufeff" + [head, ...lines].map((l) => l.join(";")).join("\n")], { type: "text/csv;charset=utf-8" });
    const el = document.createElement("a"); el.href = URL.createObjectURL(blob); el.download = "fechamentos.csv"; el.click(); URL.revokeObjectURL(el.href);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-ops-ink text-ops-ink-foreground shadow-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <OpsLabel>Competência</OpsLabel>
            <div className="flex items-center gap-2">
              <Input type="month" value={month} max={prevMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} className="h-9 w-[160px] bg-transparent border-ops-ink-foreground/20" aria-label="Mês do fechamento" />
              <span className={cn("font-ops-label text-[11px] uppercase tracking-[0.18em] rounded border px-2 py-1",
                period ? "border-primary text-primary" : "border-ops-ink-foreground/30 text-ops-ink-foreground/70")}>
                {period ? (periodAdjustments.length ? "Fechado + ajustes" : "Fechado") : "Aberto"}
              </span>
            </div>
          </div>
          {period && <p className="text-sm text-ops-ink-foreground/70"><Lock className="inline h-3.5 w-3.5 mr-1" />Fechado em {dt(period.closed_at)} por {nameOf(period.closed_by)}</p>}
        </div>

        {!canCloseMonth ? (
          <p className="text-sm text-ops-ink-foreground/70">A conferência e o fechamento exigem a permissão “Fechar mês”, concedida por quem administra o financeiro da equipe.</p>
        ) : preview.isError ? (
          <div className="flex items-center gap-3 text-sm"><span>Não foi possível carregar a conferência.</span><Button size="sm" variant="secondary" className="gap-1.5" onClick={() => preview.refetch()}><RefreshCw className="h-4 w-4" />Tentar de novo</Button></div>
        ) : preview.isLoading ? <Skeleton className="h-28 w-full bg-ops-ink-foreground/10" /> : (
          <>
            {/* Checklist ruler: one tick per check */}
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-px rounded-lg overflow-hidden bg-ops-ink-foreground/10">
              {items.map((i) => {
                const ok = i.count === 0;
                const Icon = ok ? CheckCircle2 : i.severity === "block" ? XCircle : TriangleAlert;
                return (
                  <div key={i.code} title={CHECKLIST_TEXT[i.code].help} className={cn("bg-ops-ink p-3 space-y-1 border-t-2", ok ? "border-ops-ink-foreground/20" : i.severity === "block" ? "border-destructive" : "border-primary")}>
                    <div className="flex items-center gap-1.5"><Icon className={cn("h-3.5 w-3.5", ok ? "text-ops-ink-foreground/50" : i.severity === "block" ? "text-destructive" : "text-primary")} /><OpsLabel className="text-ops-ink-foreground/60 tracking-[0.1em]">{ok ? "OK" : i.severity === "block" ? "Bloqueia" : "Aviso"}</OpsLabel></div>
                    <div className="font-ops-display text-2xl font-semibold tabular-nums leading-none">{i.amount != null && i.count ? (i.code === "hours_without_cost" ? `${i.count}` : formatBRL(i.amount)) : i.count}</div>
                    <p className="text-xs leading-tight text-ops-ink-foreground/80">{CHECKLIST_TEXT[i.code].label}{i.code === "hours_without_cost" && i.count > 0 && i.amount != null ? ` · ${i.amount.toLocaleString("pt-BR")} h` : ""}</p>
                  </div>
                );
              })}
            </div>
            {!period && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ops-ink-foreground/80">
                  {!ended ? "Este mês ainda não terminou; você pode simular, mas não fechar."
                    : blocked.length ? `${blocked.length} pendência(s) bloqueiam o fechamento. Passe o mouse sobre cada item para ver o que corrigir.`
                    : "Conferência sem bloqueios. Revise a simulação abaixo antes de confirmar."}
                </p>
                <Button disabled={!ended || !canClose(items) || busy} onClick={() => setConfirmOpen(true)} className="gap-1.5"><Lock className="h-4 w-4" />Fechar {monthName(month)}</Button>
              </div>
            )}
          </>
        )}
      </section>

      {canCloseMonth && !period && !preview.isLoading && !preview.isError && (
        <section className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between"><OpsLabel>Simulação do fechamento · nada é gravado</OpsLabel>
            <span className="text-sm tabular-nums">Resultado {formatBRL(simTotal.result)} · margem {formatPct(simTotal.gross ? simTotal.result / simTotal.gross : null)}</span></div>
          {sim.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum lançamento nem custo neste mês.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead className="border-b"><tr className="text-left">{["Quadro", "Bruto", "Líquida", "Custo total", "Resultado", "Margem"].map((h, i) => <th key={h} className={cn("py-2 px-2 font-ops-label text-[10px] uppercase tracking-[0.12em] text-muted-foreground", i && "text-right")}>{h}</th>)}</tr></thead>
              <tbody className="divide-y">{sim.map((r) => (
                <tr key={r.board_id}><td className="py-2 px-2">{r.board_name}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{formatBRL(r.gross)}</td><td className="py-2 px-2 text-right tabular-nums">{formatBRL(r.netRevenue)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{formatBRL(r.totalCost)}</td>
                  <td className={cn("py-2 px-2 text-right tabular-nums", r.result < 0 && "text-destructive")}>{formatBRL(r.result)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{formatPct(r.margin)}</td></tr>))}</tbody>
            </table></div>
          )}
        </section>
      )}

      {period && adjBoards.length > 0 && (
        <section className="rounded-xl border bg-card p-4 space-y-3">
          <OpsLabel>Novo ajuste em {monthName(month)}</OpsLabel>
          <p className="text-sm text-muted-foreground">Corrige o mês fechado sem apagar o valor original. Use valor negativo para reduzir.</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_140px]">
            <Select value={adj.target} onValueChange={(v) => setAdj((a) => ({ ...a, target: v as AdjustmentTarget, board: "" }))}><SelectTrigger aria-label="Campo"><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(ADJUSTMENT_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
            <Select value={adj.board} onValueChange={(v) => setAdj((a) => ({ ...a, board: v }))}><SelectTrigger aria-label="Quadro"><SelectValue placeholder="Quadro" /></SelectTrigger>
              <SelectContent>{adjBoards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select>
            <Input inputMode="decimal" placeholder="Valor (R$)" value={adj.amount} onChange={(e) => setAdj((a) => ({ ...a, amount: e.target.value }))} aria-label="Valor" />
          </div>
          <Textarea placeholder="Motivo do ajuste (obrigatório)" value={adj.reason} onChange={(e) => setAdj((a) => ({ ...a, reason: e.target.value }))} rows={2} />
          <div className="flex justify-end"><Button onClick={addAdjustment} disabled={busy}>Registrar ajuste</Button></div>
        </section>
      )}

      <section className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between"><OpsLabel>Histórico de fechamentos e ajustes</OpsLabel>
          {can("finance.export") && (history.data?.periods.length ?? 0) > 0 && <Button size="sm" variant="outline" className="gap-1.5" onClick={exportCsv}><Download className="h-4 w-4" />CSV</Button>}</div>
        {history.isError ? <div className="flex items-center gap-3 text-sm"><span>Não foi possível carregar o histórico.</span><Button size="sm" variant="outline" onClick={() => history.refetch()}>Tentar de novo</Button></div>
          : history.isLoading ? <Skeleton className="h-20 w-full" />
          : !history.data?.periods.length ? <p className="text-sm text-muted-foreground">Nenhum mês fechado ainda.</p> : (
            <ol className="relative border-l pl-4 space-y-3">
              {history.data.periods.map((p) => (
                <li key={p.id} className="space-y-1">
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  <p className="text-sm"><button className="font-medium capitalize hover:underline" onClick={() => setMonth(p.competence.substring(0, 7))}>{monthName(p.competence.substring(0, 7))}</button>
                    <span className="text-muted-foreground"> · fechado em {dt(p.closed_at)} por {nameOf(p.closed_by)}</span></p>
                  {history.data!.adjustments.filter((a) => a.period_id === p.id).map((a) => (
                    <p key={a.id} className="text-xs text-muted-foreground pl-2 border-l-2 border-primary/40">
                      Ajuste {ADJUSTMENT_LABEL[a.target as AdjustmentTarget]} {a.amount > 0 ? "+" : ""}{formatBRL(a.amount)} em {boardName(a.board_id)} — “{a.reason}” · {nameOf(a.created_by)}, {dt(a.created_at)}
                    </p>
                  ))}
                </li>
              ))}
            </ol>
          )}
      </section>

      <AlertDialog open={confirmOpen} onOpenChange={(v) => !busy && setConfirmOpen(v)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Fechar {monthName(month)}?</AlertDialogTitle>
            <AlertDialogDescription>Os números serão guardados como estão agora e os lançamentos deste mês ficarão travados. Correções futuras só por ajustes. Digite <strong>{month}</strong> para confirmar.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={month} aria-label="Confirmação do mês" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy || typed !== month} onClick={(e) => { e.preventDefault(); void close(); }}>Fechar mês</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
