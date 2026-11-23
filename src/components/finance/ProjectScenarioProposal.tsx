import { formatBRL, formatPct } from "@/lib/finance/engine";
import { simulatePricing, type Scenario } from "@/lib/finance/simulator";

/** Valores da simulação que deu origem ao projeto (só existe em projetos criados a partir de um cenário). */
export function ProjectScenarioProposal({ scenario }: { scenario: Scenario }) {
  const r = simulatePricing(scenario);
  const rows: [string, string][] = [
    ["Receita estimada", formatBRL(scenario.gross)],
    ["Impostos", `${formatBRL(r.tax)} (${formatPct(scenario.tax_rate)})`],
    ["Custo da equipe", formatBRL(scenario.team_cost)],
    ["Horas previstas", `${scenario.planned_hours.toLocaleString("pt-BR")} h`],
    ["Despesas diretas", formatBRL(scenario.direct_expenses)],
    ["Custos compartilhados", formatBRL(scenario.shared_costs)],
    ["Custos variáveis", formatBRL(r.variableCost)],
    ["Resultado previsto", formatBRL(r.result)],
    ["Margem prevista", `${formatPct(r.margin)} · meta ${formatPct(scenario.margin_target)}`],
  ];
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Valor mínimo a cobrar para bater a meta</p>
          <p className="text-2xl font-bold tabular-nums text-primary">{r.minimum === null ? "Indisponível" : formatBRL(r.minimum)}</p>
        </div>
        <p className="text-xs text-muted-foreground text-right">Simulação “{scenario.name}”{scenario.client_label ? ` · ${scenario.client_label}` : ""}<br />Competência {scenario.competence.substring(5, 7)}/{scenario.competence.substring(0, 4)}</p>
      </div>
      <dl className="divide-y rounded-xl border">
        {rows.map(([k, v]) => <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium tabular-nums">{v}</dd></div>)}
      </dl>
      <p className="text-[11px] text-muted-foreground">Valores congelados da simulação — servem de referência e não alteram os lançamentos reais do projeto.</p>
    </div>
  );
}
