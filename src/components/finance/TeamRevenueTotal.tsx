import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatBRL, formatPct } from "@/lib/finance/engine";
import { OpsLabel } from "@/components/ops/OpsParts";
import { cn } from "@/lib/utils";

interface RevenueRow {
  project_id: string | null;
  name: string;
  gross: number;
}

interface Summary {
  tax_rate: number;
  gross: number;
  tax: number;
  projects: RevenueRow[];
}

/**
 * Faturamento geral da equipe no período: a soma do faturamento de todos os projetos.
 * Faturamento antigo lançado sem projeto aparece numa linha separada ("Sem projeto"),
 * para que o total nunca conte nada duas vezes.
 */
export function TeamRevenueTotal({ teamId, from, to }: { teamId: string | null; from: string; to: string }) {
  const { user } = useAuth();
  const ml = (m: string) => `${m.substring(5, 7)}/${m.substring(0, 4)}`;
  const label = from === to ? ml(from) : `${ml(from)} a ${ml(to)}`;
  const q = useQuery({
    queryKey: ["team-revenue-summary", teamId, from, to, user?.id],
    enabled: !!user && !!teamId && from <= to,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_revenue_summary_range", { _team_id: teamId!, _from: `${from}-01`, _to: `${to}-01` });
      if (error) throw error;
      return (data ?? null) as unknown as Summary | null;
    },
  });

  if (!teamId) return null;
  if (q.isError) return <p className="text-sm text-muted-foreground">Não foi possível carregar o faturamento geral da equipe.</p>;
  if (!q.data) return null;

  const s = q.data;
  const rows = s.projects ?? [];
  const net = s.gross - s.tax;

  return (
    <section className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <OpsLabel>Faturamento geral da equipe · {label}</OpsLabel>
          <p className="text-2xl font-semibold tabular-nums leading-tight">{formatBRL(s.gross)}</p>
        </div>
        <div className="text-right text-xs text-muted-foreground tabular-nums">
          <p>NF {formatPct(s.tax_rate)} · {formatBRL(s.tax)}</p>
          <p className="text-sm font-medium text-foreground">Líquido {formatBRL(net)}</p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum faturamento lançado neste período.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {rows.map((r) => (
            <li key={r.project_id ?? "no-project"} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span className={cn("truncate", !r.project_id && "text-muted-foreground")}>{r.name}</span>
              <span className="tabular-nums font-medium shrink-0">{formatBRL(r.gross)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
