import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonthField } from "@/components/ops/MonthField";
import { formatBRL, formatPct } from "@/lib/finance/engine";
import { useTeamDefaults } from "@/hooks/useTeamDefaults";

const FIELDS = [
  { k: "hourly", label: "Hora/homem (R$)", pct: false },
  { k: "tax", label: "Impostos %", pct: true },
  { k: "variable", label: "Custos variáveis %", pct: true },
  { k: "alloc", label: "Rateio %", pct: true },
  { k: "target", label: "Meta de margem %", pct: true },
  { k: "discount", label: "Desconto máximo %", pct: true },
] as const;
type Key = (typeof FIELDS)[number]["k"];

export function TeamDefaultsPanel({ teamId }: { teamId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const rows = useTeamDefaults(teamId);
  const thisMonth = new Date().toISOString().substring(0, 7);
  const [from, setFrom] = useState(thisMonth);
  const [f, setF] = useState<Record<Key, string>>({ hourly: "", tax: "", variable: "", alloc: "", target: "", discount: "" });
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["finance-team-defaults", teamId] });
  const p = (v: string) => Number(v || 0) / 100;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (p(f.tax) + p(f.variable) + p(f.alloc) + p(f.target) >= 1) return toast({ title: "Impostos, custos, rateio e meta somam 100% ou mais.", variant: "destructive" });
    setBusy(true);
    const { error } = await supabase.from("finance_team_defaults").upsert({
      team_id: teamId, valid_from: `${from}-01`, hourly_cost: Number(f.hourly || 0), tax_rate: p(f.tax), variable_rate: p(f.variable),
      allocation_pct: p(f.alloc), margin_target: p(f.target), max_discount: p(f.discount), created_by: user!.id, updated_at: new Date().toISOString(),
    }, { onConflict: "team_id,valid_from" });
    setBusy(false);
    if (error) return toast({ title: "Não foi possível salvar.", variant: "destructive" });
    toast({ title: "Valores padrão salvos" });
    refresh();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("finance_team_defaults").delete().eq("id", id);
    if (error) return toast({ title: "Não foi possível remover.", variant: "destructive" });
    refresh();
  };

  return (
    <details open className="group rounded-xl border bg-card xl:col-span-2">
      <summary className="cursor-pointer list-none px-4 py-3 sm:px-5">
        <h3 className="text-sm font-semibold">Valores padrão</h3>
        <p className="text-xs text-muted-foreground">Hora/homem, alíquotas, rateio, meta e desconto. São copiados para o projeto quando um quadro é incorporado e alimentam o preço mínimo do contrato.</p>
      </summary>
      <div className="space-y-3 border-t px-4 py-4 sm:px-5 text-sm">
        <form onSubmit={save} className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 items-end">
          <label className="space-y-1"><span className="text-xs text-muted-foreground">Vale a partir de</span>
            <MonthField value={from} onChange={setFrom} aria-label="Vale a partir de" /></label>
          {FIELDS.map((x) => (
            <label key={x.k} className="space-y-1"><span className="text-xs text-muted-foreground">{x.label}</span>
              <Input type="number" min={0} max={x.pct ? 99 : undefined} step="0.01" value={f[x.k]} onChange={(e) => setF({ ...f, [x.k]: e.target.value })}
                required={x.k === "hourly"} className="h-9" /></label>
          ))}
          <Button type="submit" size="sm" className="h-9" disabled={busy}>Salvar</Button>
        </form>
        {rows.isError && <p className="text-destructive text-xs">Não foi possível carregar os valores padrão.</p>}
        {(rows.data ?? []).length > 0 && (
          <ul className="divide-y rounded-lg border">
            {rows.data!.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <span className="w-20 tabular-nums">{r.valid_from.substring(0, 7).split("-").reverse().join("/")}</span>
                <span className="flex-1 text-muted-foreground tabular-nums">
                  {formatBRL(Number(r.hourly_cost))}/h · Impostos {formatPct(Number(r.tax_rate))} · Variáveis {formatPct(Number(r.variable_rate))} · Rateio {formatPct(Number(r.allocation_pct))} · Meta {formatPct(Number(r.margin_target))} · Desconto máx. {formatPct(Number(r.max_discount))}
                </span>
                <Button variant="ghost" size="sm" className="h-7" onClick={() => remove(r.id)}>Remover</Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
