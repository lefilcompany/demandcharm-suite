import { useState } from "react";
import { Input } from "@/components/ui/input";
import { OpsLabel } from "@/components/ops/OpsParts";
import { formatBRL, formatPct } from "@/lib/finance/engine";
import { settingsFor } from "@/lib/finance/projectRollup";
import { minimumPrice } from "@/lib/finance/pricing";
import { useTeamDefaults } from "@/hooks/useTeamDefaults";

export function ProjectMinimumPrice({ teamId }: { teamId: string | null }) {
  const rows = useTeamDefaults(teamId);
  const [hours, setHours] = useState("160");
  const month = new Date().toISOString().substring(0, 7);
  const d = settingsFor(rows.data ?? [], month);

  if (rows.isError) return <p className="text-sm text-destructive">Não foi possível carregar os valores padrão.</p>;
  if (rows.isLoading) return null;
  if (!d) return (
    <div className="rounded-xl border bg-card p-6 text-center text-sm space-y-1">
      <p className="font-medium">Sem valores padrão cadastrados.</p>
      <p className="text-muted-foreground">Cadastre hora/homem, alíquotas e meta em Finanças → Lançamentos e acesso → Valores padrão.</p>
    </div>
  );
  const vals = { hourlyCost: Number(d.hourly_cost), taxRate: Number(d.tax_rate), variableRate: Number(d.variable_rate),
    allocationPct: Number(d.allocation_pct), marginTarget: Number(d.margin_target), maxDiscount: Number(d.max_discount) };
  const r = minimumPrice(Number(hours) || 0, vals);

  return (
    <div className="space-y-4 text-sm">
      <label className="block max-w-xs space-y-1"><span className="text-xs text-muted-foreground">Horas estimadas por mês</span>
        <Input type="number" min={0} step="1" value={hours} onChange={(e) => setHours(e.target.value)} className="h-9" /></label>
      <section className="rounded-xl bg-ops-ink text-ops-ink-foreground p-4 sm:p-5 grid gap-4 sm:grid-cols-3">
        <div><OpsLabel>Preço mínimo a cobrar</OpsLabel>
          <div className="font-ops-display text-3xl font-semibold tabular-nums">{r.ok ? formatBRL(r.minimumPrice) : "—"}</div></div>
        <div><OpsLabel>Preço de tabela (com desconto máx.)</OpsLabel>
          <div className="font-ops-display text-2xl font-semibold tabular-nums">{r.ok ? formatBRL(r.listPrice) : "—"}</div></div>
        <div><OpsLabel>Custo de horas</OpsLabel>
          <div className="font-ops-display text-2xl font-semibold tabular-nums">{formatBRL(r.laborCost)}</div></div>
      </section>
      {!r.ok && <p className="text-primary">Impostos, custos variáveis, rateio e meta somam {formatPct(r.takeRate)}: não existe preço que cubra tudo. Revise os valores padrão.</p>}
      <p className="text-muted-foreground tabular-nums">
        Base: {formatBRL(vals.hourlyCost)}/h · Impostos {formatPct(vals.taxRate)} · Variáveis {formatPct(vals.variableRate)} · Rateio {formatPct(vals.allocationPct)} · Meta {formatPct(vals.marginTarget)} · Desconto máx. {formatPct(vals.maxDiscount)}
      </p>
    </div>
  );
}
