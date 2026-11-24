import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatBRL, formatPct, resultTone } from "@/lib/finance/engine";
import { profitability, type ProfitInput } from "@/lib/finance/profitability";

const hrs = (h: number) => `${h.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
const pct = (v: number | null) => (v == null ? "—" : formatPct(v));

function Head({ children, hint, right = true }: { children: React.ReactNode; hint?: string; right?: boolean }) {
  return (
    <th className={cn("px-3 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap", right ? "text-right" : "text-left")}>
      <span className="inline-flex items-center gap-1">{children}
        {hint && <Tooltip><TooltipTrigger asChild><Info className="h-3 w-3" aria-label={hint} /></TooltipTrigger><TooltipContent className="max-w-xs text-xs">{hint}</TooltipContent></Tooltip>}
      </span>
    </th>
  );
}

export function ProfitabilityTable({ items }: { items: ProfitInput[] }) {
  const { rows, total, coverage, completeCount } = profitability(items);
  const sorted = [...rows].sort((a, b) => (b.margin ?? -Infinity) - (a.margin ?? -Infinity));
  return (
    <section className="rounded-xl border bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3">
        <div>
          <h3 className="text-sm font-semibold">Rentabilidade por projeto</h3>
          <p className="text-xs text-muted-foreground">Margem = resultado ÷ faturamento. Rentabilidade = resultado ÷ custo (quanto cada R$ 1 investido retornou).</p>
        </div>
        <div className="rounded-lg bg-muted px-3 py-2 text-right">
          <div className="text-[11px] text-muted-foreground">Projetos com números completos</div>
          <div className="text-lg font-semibold tabular-nums">{pct(coverage)} <span className="text-xs font-normal text-muted-foreground">({completeCount} de {rows.length})</span></div>
        </div>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-y bg-muted/40">
            <tr>
              <Head right={false}>Projeto</Head>
              <Head hint="Faturamento menos impostos.">Receita líquida</Head>
              <Head hint="Horas × custo/hora + despesas + parte dos custos da equipe.">Custo total</Head>
              <Head hint="Horas apontadas no timer.">Horas</Head>
              <Head>Resultado</Head>
              <Head hint="Resultado ÷ faturamento bruto.">Margem</Head>
              <Head hint="Resultado ÷ custo total.">Rentabilidade</Head>
              <Head hint="Resultado ÷ horas apontadas.">Resultado/hora</Head>
            </tr>
          </thead>
          <tbody className="divide-y">
            {sorted.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 min-w-[180px]">
                  <div className="font-medium">{r.name}</div>
                  {!r.complete && <div className="text-[11px] text-muted-foreground">{r.gross <= 0 ? "Sem faturamento no período" : r.hours <= 0 ? "Sem horas apontadas" : r.hoursWithoutCost > 0 ? "Há horas sem custo cadastrado" : "Sem custos no período"}</div>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatBRL(r.netRevenue)}</td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatBRL(r.totalCost)}</td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{hrs(r.hours)}</td>
                <td className={cn("px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium", resultTone(r.result))}>{formatBRL(r.result)}</td>
                <td className={cn("px-3 py-2 text-right tabular-nums whitespace-nowrap font-semibold", r.margin != null && resultTone(r.margin))}>{pct(r.margin)}</td>
                <td className={cn("px-3 py-2 text-right tabular-nums whitespace-nowrap", r.roi != null && resultTone(r.roi))}>{pct(r.roi)}</td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{r.resultPerHour == null ? "—" : formatBRL(r.resultPerHour)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 bg-muted/40 font-semibold">
            <tr>
              <td className="px-3 py-2 whitespace-nowrap">Total da equipe</td>
              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatBRL(total.netRevenue)}</td>
              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatBRL(total.totalCost)}</td>
              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{hrs(total.hours)}</td>
              <td className={cn("px-3 py-2 text-right tabular-nums whitespace-nowrap", resultTone(total.result))}>{formatBRL(total.result)}</td>
              <td className={cn("px-3 py-2 text-right tabular-nums whitespace-nowrap", total.margin != null && resultTone(total.margin))}>{pct(total.margin)}</td>
              <td className={cn("px-3 py-2 text-right tabular-nums whitespace-nowrap", total.roi != null && resultTone(total.roi))}>{pct(total.roi)}</td>
              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{total.resultPerHour == null ? "—" : formatBRL(total.resultPerHour)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}
