import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonthField } from "@/components/ops/MonthField";
import { OpsLabel } from "@/components/ops/OpsParts";
import { formatBRL, formatPct } from "@/lib/finance/engine";
import { useTeamDefaults, useTeamHourlyCost } from "@/hooks/useTeamDefaults";
import { cn } from "@/lib/utils";

type Key = "tax" | "variable" | "alloc" | "target" | "discount";

/** Ordem e cor de cada percentual na régua de composição da receita. */
const PARTS: { k: Key; label: string; tone: string }[] = [
  { k: "tax", label: "Impostos", tone: "bg-ops-ink" },
  { k: "variable", label: "Custos variáveis", tone: "bg-ops-ink/60" },
  { k: "alloc", label: "Rateio", tone: "bg-ops-ink/25" },
  { k: "target", label: "Meta de margem", tone: "bg-primary" },
];
const PART_KEYS = PARTS.map((x) => x.k);

/** Os campos são apresentados em dois blocos: o que reduz a receita e o que se espera dela. */
const GROUPS: { title: string; hint: string; keys: Key[] }[] = [
  { title: "O que sai da receita", hint: "Cada percentual abaixo reduz o que sobra do faturamento.", keys: ["tax", "variable", "alloc"] },
  { title: "Metas comerciais", hint: "A meta define o preço mínimo do contrato; o desconto limita a negociação.", keys: ["target", "discount"] },
];

const LABELS: Record<Key, string> = {
  tax: "Impostos", variable: "Custos variáveis", alloc: "Rateio", target: "Meta de margem", discount: "Desconto máximo",
};

const toStr = (v: number) => String(+(Number(v) * 100).toFixed(2));
const toNum = (v: string) => Number(String(v || 0).replace(",", "."));

/** Linha em vigor no mês: a mais recente com início até o mês escolhido; nenhuma se o mês é anterior a todas. */
export function inForceRow<T extends { valid_from: string }>(rows: T[], month: string): T | undefined {
  return rows.filter((r) => r.valid_from.substring(0, 7) <= month).sort((a, b) => (a.valid_from < b.valid_from ? 1 : -1))[0];
}

export type SavedDefaults = { tax_rate: number; variable_rate: number; margin_target: number; max_discount: number };

function PctField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label htmlFor={id} className="min-w-0 space-y-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="relative block">
        <Input id={id} type="number" min={0} max={99} step="0.01" inputMode="decimal" value={value}
          onChange={(e) => onChange(e.target.value)} className="h-9 pr-7 tabular-nums" />
        <span aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
      </span>
    </label>
  );
}

/** Régua: para cada R$ 100 de receita, quanto sai e quanto sobra. */
function RevenueRuler({ values }: { values: Record<Key, string> }) {
  const pct = PARTS.map((x) => ({ ...x, pct: Math.max(0, toNum(values[x.k])) }));
  const sum = pct.reduce((s, x) => s + x.pct, 0);
  const over = sum > 100;
  const scale = over ? sum : 100;
  const folga = Math.max(0, 100 - sum);
  return (
    <div className="space-y-2.5 rounded-lg border bg-muted/25 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <OpsLabel>Composição de R$ 100 de receita</OpsLabel>
        <span className={cn("text-xs tabular-nums", over ? "text-destructive" : "text-muted-foreground")}>
          {over ? "Somam " : "Sobra "}
          {!over && <strong className="font-medium text-foreground">{formatPct(folga / 100)}</strong>}
          {over && <strong className="font-medium">{sum.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong>}
          {over ? " do faturamento" : " depois de impostos, custos, rateio e meta"}
        </span>
      </div>
      <div className={cn("flex h-2.5 w-full overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border", over && "ring-destructive/60")}
        role="img" aria-label={`Composição da receita: ${pct.map((x) => `${x.label} ${x.pct}%`).join(", ")}`}>
        {pct.map((x) => x.pct > 0 && (
          <span key={x.k} className={cn("h-full transition-[width] duration-300 motion-reduce:transition-none", x.tone)} style={{ width: `${(x.pct / scale) * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {pct.map((x) => (
          <li key={x.k} className="flex items-center gap-1.5">
            <span aria-hidden className={cn("h-2 w-2 rounded-sm", x.tone)} />
            <span className="text-muted-foreground">{x.label}</span>
            <span className="tabular-nums font-medium">{x.pct.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</span>
            <span className="tabular-nums text-muted-foreground">· {formatBRL(x.pct)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TeamDefaultsPanel({ teamId, onSaved }: { teamId: string; onSaved?: (v: SavedDefaults) => Promise<void> | void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const rows = useTeamDefaults(teamId);
  const thisMonth = new Date().toISOString().substring(0, 7);
  const [from, setFrom] = useState(thisMonth);
  const [f, setF] = useState<Record<Key, string>>({ tax: "", variable: "", alloc: "", target: "", discount: "" });
  const [busy, setBusy] = useState(false);
  const hourly = useTeamHourlyCost(teamId, thisMonth);
  const refresh = () => qc.invalidateQueries({ queryKey: ["finance-team-defaults", teamId] });
  const p = (v: string) => toNum(v) / 100;
  const set = (k: Key) => (v: string) => { dirty.current = true; setF((s) => ({ ...s, [k]: v })); };

  /** Mostra os valores já vigentes no mês escolhido, sem sobrescrever o que a pessoa está digitando. */
  const dirty = useRef(false);
  const list = rows.data ?? [];
  const prefillKey = `${from}|${list.map((r) => `${r.id}:${r.valid_from}`).join(",")}`;
  const prefilled = useRef("");
  useEffect(() => { dirty.current = false; }, [from]);
  useEffect(() => {
    if (rows.isLoading || dirty.current || prefilled.current === prefillKey) return;
    prefilled.current = prefillKey;
    const base = inForceRow(list, from);
    if (!base) return;
    setF({ tax: toStr(base.tax_rate), variable: toStr(base.variable_rate), alloc: toStr(base.allocation_pct), target: toStr(base.margin_target), discount: toStr(base.max_discount) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey, rows.isLoading]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const vals = [...PART_KEYS, "discount"].map((k) => toNum(f[k as Key]));
    if (vals.some((v) => !Number.isFinite(v) || v < 0 || v >= 100)) return toast({ title: "Use percentuais entre 0 e 99,99%.", variant: "destructive" });
    if (p(f.tax) + p(f.variable) + p(f.alloc) + p(f.target) >= 1) return toast({ title: "Impostos, custos, rateio e meta somam 100% ou mais.", variant: "destructive" });
    setBusy(true);
    const { error } = await supabase.from("finance_team_defaults").upsert({
      team_id: teamId, valid_from: `${from}-01`, tax_rate: p(f.tax), variable_rate: p(f.variable),
      allocation_pct: p(f.alloc), margin_target: p(f.target), max_discount: p(f.discount), created_by: user!.id, updated_at: new Date().toISOString(),
    }, { onConflict: "team_id,valid_from" });
    setBusy(false);
    if (error) return toast({ title: "Não foi possível salvar.", variant: "destructive" });
    await onSaved?.({ tax_rate: p(f.tax), variable_rate: p(f.variable), margin_target: p(f.target), max_discount: p(f.discount) });
    toast({ title: "Valores padrão salvos", description: onSaved ? "O perfil \"Padrão da equipe\" foi atualizado." : undefined });
    refresh();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("finance_team_defaults").delete().eq("id", id);
    if (error) return toast({ title: "Não foi possível remover.", variant: "destructive" });
    refresh();
  };

  const over = PARTS.reduce((s, x) => s + Math.max(0, toNum(f[x.k])), 0) >= 100;

  return (
    <details open className="group rounded-xl border bg-card">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <OpsLabel>Parâmetros da equipe</OpsLabel>
          <h3 className="mt-0.5 text-sm font-semibold">Valores padrão</h3>
          <p className="text-xs text-muted-foreground">Alíquotas, rateio, meta e desconto. São copiados para o projeto quando um quadro é incorporado e alimentam o preço mínimo do contrato.</p>
        </div>
        <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>

      <div className="space-y-4 border-t px-4 py-4 sm:px-5 text-sm">
        <p className="text-muted-foreground">
          Hora/homem da equipe: <strong className="text-foreground tabular-nums">{hourly.data?.hourly_cost != null ? `${formatBRL(Number(hourly.data.hourly_cost))}/h` : "—"}</strong>
          {hourly.data?.competence ? ` · média de ${hourly.data.people} pessoa(s) em ${hourly.data.competence.substring(0, 7).split("-").reverse().join("/")}, pelo custo e horas lançados para cada um` : " · lance o custo de cada pessoa em \"Custo das pessoas\" para calcular"}
        </p>

        <form onSubmit={save} noValidate className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)] sm:items-end">
            <div className="min-w-0 space-y-1.5">
              <span className="text-xs text-muted-foreground">Vale a partir de</span>
              <MonthField value={from} onChange={setFrom} aria-label="Vale a partir de" />
            </div>
            <p className="pb-2 text-xs text-muted-foreground">Meses anteriores mantêm os valores já salvos. Editar este mês substitui a linha vigente.</p>
          </div>

          {GROUPS.map((g) => (
            <fieldset key={g.title} className="border-t pt-4">
              <legend className="sr-only">{g.title}</legend>
              <div className="mb-3">
                <OpsLabel>{g.title}</OpsLabel>
                <p className="text-xs text-muted-foreground">{g.hint}</p>
              </div>
              <div className={cn("grid gap-3", g.keys.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
                {g.keys.map((k) => <PctField key={k} id={`default-${k}`} label={LABELS[k]} value={f[k]} onChange={set(k)} />)}
              </div>
            </fieldset>
          ))}

          <RevenueRuler values={f} />

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className={cn("text-xs", over ? "text-destructive" : "text-muted-foreground")}>
              {over ? "Impostos, custos, rateio e meta somam 100% ou mais. Reduza algum valor para salvar." : "Percentuais entre 0 e 99,99%. Nada é alterado em projetos já criados."}
            </p>
            <Button type="submit" size="sm" className="h-9 px-5" disabled={busy}>Salvar</Button>
          </div>
        </form>

        {rows.isError && <p className="text-destructive text-xs">Não foi possível carregar os valores padrão.</p>}
        {(rows.data ?? []).length > 0 && (
          <div className="border-t pt-4">
            <OpsLabel>Histórico por vigência</OpsLabel>
            <ul className="mt-2 divide-y rounded-lg border">
              <li className="hidden grid-cols-[minmax(0,86px)_repeat(5,minmax(0,1fr))_72px] gap-2 px-3 py-2 sm:grid">
                <OpsLabel>Início</OpsLabel>
                {(["tax", "variable", "alloc", "target", "discount"] as Key[]).map((k) => <OpsLabel key={k}>{LABELS[k]}</OpsLabel>)}
                <span />
              </li>
              {rows.data!.map((r) => (
                <li key={r.id} className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 py-2 sm:grid-cols-[minmax(0,86px)_repeat(5,minmax(0,1fr))_72px] sm:items-center sm:gap-2">
                  <span className="font-ops-label text-[11px] tabular-nums">{r.valid_from.substring(0, 7).split("-").reverse().join("/")}</span>
                  {(["tax", "variable", "alloc", "target", "discount"] as Key[]).map((k) => {
                    const v = k === "tax" ? r.tax_rate : k === "variable" ? r.variable_rate : k === "alloc" ? r.allocation_pct : k === "target" ? r.margin_target : r.max_discount;
                    return <span key={k} className="flex items-baseline justify-between gap-2 sm:block">
                      <span className="text-xs text-muted-foreground sm:hidden">{LABELS[k]}</span>
                      <span className="tabular-nums">{formatPct(Number(v))}</span>
                    </span>;
                  })}
                  <Button variant="ghost" size="sm" className="col-span-2 h-7 justify-self-end sm:col-span-1" onClick={() => remove(r.id)}>Remover</Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}
