import { useMemo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { PeopleRow } from "@/hooks/useFinance";
import { OpsLabel } from "@/components/ops/OpsParts";
import { AllocationBar, OccupancyRuler } from "@/components/finance/AllocationBar";
import { costPerHour, formatBRL, formatPct } from "@/lib/finance/engine";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const hrs = (h: number) => `${h.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
const monthLabel = (iso: string) => new Date(`${iso.substring(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

export function CostsProductivity({ rows, detailed, isLoading, isError, onRetry, boardOrder }: {
  rows: PeopleRow[]; detailed: boolean; isLoading: boolean; isError: boolean; onRetry: () => void; boardOrder: string[];
}) {
  const people = useMemo(() => {
    const m = new Map<string, { userId: string; name: string; month: string; cost: number | null; ref: number | null; hours: number; boards: PeopleRow[] }>();
    rows.filter((r) => r.user_id).forEach((r) => {
      const k = `${r.user_id}|${r.competence}`;
      const p = m.get(k) ?? { userId: r.user_id!, name: r.full_name ?? "Pessoa", month: r.competence, cost: r.monthly_cost, ref: r.productive_hours, hours: 0, boards: [] };
      p.hours += r.hours;
      if (r.board_id) p.boards.push(r);
      m.set(k, p);
    });
    return [...m.values()].sort((a, b) => b.month.localeCompare(a.month) || a.name.localeCompare(b.name));
  }, [rows]);
  const totals = useMemo(() => {
    const hours = rows.reduce((s, r) => s + r.hours, 0);
    const cost = rows.reduce((s, r) => s + (r.cost ?? 0), 0);
    const ref = people.reduce((s, p) => s + (p.ref ?? 0), 0);
    return { hours, cost, occupancy: detailed && ref > 0 ? people.reduce((s, p) => s + (p.ref ? p.hours : 0), 0) / ref : null };
  }, [rows, people, detailed]);

  if (isError) return (
    <div className="rounded-xl border p-6 text-center space-y-2">
      <p className="text-sm">Não foi possível carregar custos e horas.</p>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onRetry}><RefreshCw className="h-4 w-4" />Tentar de novo</Button>
    </div>
  );
  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const missing = people.filter((p) => p.cost == null && p.hours > 0);
  const over = people.filter((p) => p.ref && p.hours / p.ref > 1);
  const under = people.filter((p) => p.ref && p.hours / p.ref < 0.5);

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-ops-ink text-ops-ink-foreground shadow-xl grid grid-cols-1 sm:grid-cols-3">
        {[
          { l: "Horas apontadas", v: hrs(totals.hours) },
          { l: "Custo das horas", v: formatBRL(totals.cost) },
          { l: "Ocupação média", v: totals.occupancy === null ? "—" : formatPct(totals.occupancy) },
        ].map((m) => (
          <div key={m.l} className="px-5 py-3 [&:not(:first-child)]:sm:border-l border-ops-ink-foreground/10">
            <OpsLabel>{m.l}</OpsLabel><div className="font-ops-display text-3xl font-semibold tabular-nums">{m.v}</div>
          </div>
        ))}
      </section>

      {!detailed && (
        <p className="text-sm text-muted-foreground rounded-lg border px-3 py-2">
          Você vê só os totais dos quadros liberados. O custo de cada pessoa aparece para quem tem a permissão "Ver custo de cada pessoa".
        </p>
      )}

      {detailed && (missing.length > 0 || over.length > 0 || under.length > 0) && (
        <ul className="grid gap-2 md:grid-cols-3 text-sm">
          {missing.length > 0 && <Alert title={`${missing.length} sem custo no mês`} body={`As horas de ${missing.map((p) => p.name.split(" ")[0]).slice(0, 3).join(", ")} não entram no custo. Cadastre o custo em "Lançamentos e acesso".`} strong />}
          {over.length > 0 && <Alert title={`${over.length} acima de 100%`} body="Apontaram mais horas que a referência do mês. Confira as horas produtivas ou a carga." strong />}
          {under.length > 0 && <Alert title={`${under.length} abaixo de 50%`} body="Pouco tempo apontado. Pode ser timer esquecido ou capacidade livre." />}
        </ul>
      )}

      {detailed && (
        <div className="rounded-xl border bg-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr className="font-ops-label text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-normal">Pessoa</th><th className="px-3 py-2 text-left font-normal">Mês</th>
                <th className="px-3 py-2 text-right font-normal">Custo mensal</th><th className="px-3 py-2 text-right font-normal">Custo/hora</th>
                <th className="px-3 py-2 text-right font-normal">Apontadas / ref.</th><th className="px-3 py-2 text-left font-normal w-40">Ocupação</th>
                <th className="px-3 py-2 text-left font-normal min-w-[220px]">Para onde foi o custo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {people.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Ninguém apontou horas nem tem custo cadastrado no período.</td></tr>}
              {people.map((p) => {
                const occ = p.ref ? p.hours / p.ref : null;
                const cph = p.cost != null && p.ref ? costPerHour(p.cost, p.ref) : null;
                const spent = p.boards.reduce((s, b) => s + (b.cost ?? 0), 0);
                return (
                  <tr key={`${p.userId}${p.month}`}>
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{p.name}</td>
                    <td className="px-3 py-2 font-ops-label text-xs uppercase">{monthLabel(p.month)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{p.cost == null ? <span className="text-primary inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />sem custo</span> : formatBRL(p.cost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{cph == null ? "—" : formatBRL(cph)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{hrs(p.hours)} / {p.ref ? hrs(p.ref) : "—"}</td>
                    <td className="px-3 py-2"><div className="flex items-center gap-2"><OccupancyRuler value={occ} /><span className="tabular-nums text-xs w-10 text-right">{occ === null ? "—" : `${Math.round(occ * 100)}%`}</span></div></td>
                    <td className="px-3 py-2">
                      {p.boards.length === 0 ? <span className="text-xs text-muted-foreground">sem horas no mês</span> : p.cost == null
                        ? <span className="text-xs text-muted-foreground">{p.boards.map((b) => `${b.board_name} ${hrs(b.hours)}`).join(" · ")}</span>
                        : <AllocationBar total={spent} order={boardOrder} parts={p.boards.map((b) => ({ key: b.board_id!, label: `${b.board_name} · ${hrs(b.hours)}`, amount: b.cost ?? 0 }))} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!detailed && (
        <div className="rounded-xl border bg-card divide-y text-sm">
          {rows.length === 0 && <p className="p-6 text-center text-muted-foreground">Nenhuma hora apontada nos quadros liberados.</p>}
          {Object.values(rows.reduce<Record<string, { name: string; h: number; c: number }>>((m, r) => {
            const k = r.board_id ?? "-"; m[k] = { name: r.board_name ?? "Quadro", h: (m[k]?.h ?? 0) + r.hours, c: (m[k]?.c ?? 0) + (r.cost ?? 0) }; return m;
          }, {})).map((b) => (
            <div key={b.name} className="flex justify-between gap-3 px-4 py-2"><span className="truncate">{b.name}</span><span className="tabular-nums">{hrs(b.h)} · {formatBRL(b.c)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

function Alert({ title, body, strong }: { title: string; body: string; strong?: boolean }) {
  return (
    <li className={`rounded-lg border px-3 py-2 ${strong ? "border-primary/50" : ""}`}>
      <p className="font-medium">{title}</p><p className="text-muted-foreground text-xs">{body}</p>
    </li>
  );
}
