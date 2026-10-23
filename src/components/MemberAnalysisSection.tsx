import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Target, TrendingUp, Activity } from "lucide-react";
import { ChartPeriodSelector, type ChartPeriodType, getChartPeriodRange } from "@/components/ChartPeriodSelector";
import { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";

interface Demand {
  id: string;
  created_at: string;
  demand_statuses?: { name: string } | null;
  demand_assignees?: {
    user_id: string;
    profile: { full_name: string; avatar_url: string | null } | null;
  }[];
}

interface MemberAnalysisSectionProps {
  demands: Demand[];
}

const STATUS_COLORS = {
  toStart: "hsl(var(--plan-4))",
  inProgress: "hsl(var(--plan-2))",
  delivered: "hsl(var(--plan-1))",
};

interface MemberData {
  id: string;
  name: string;
  avatar: string | null;
  total: number;
  toStart: number;
  inProgress: number;
  delivered: number;
  deliveryRate: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    const total = payload.reduce((acc: number, p: any) => acc + (p.value || 0), 0);
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-2.5 min-w-[150px]">
        <p className="font-medium text-sm mb-1.5 text-foreground">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}</span>
            </div>
            <span className="font-medium text-foreground">{entry.value}</span>
          </div>
        ))}
        <div className="border-t border-border mt-1.5 pt-1.5 flex justify-between text-xs">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-semibold">{total}</span>
        </div>
      </div>
    );
  }
  return null;
};

export function MemberAnalysisSection({ demands }: MemberAnalysisSectionProps) {
  const [period, setPeriod] = useState<ChartPeriodType>("month");
  const isMobile = useIsMobile();

  const { members, totalAssigned, avgDeliveryRate } = useMemo(() => {
    const { start, end } = getChartPeriodRange(period);

    const filtered = demands.filter(d => {
      const date = new Date(d.created_at);
      if (start && date < start) return false;
      if (date > end) return false;
      return true;
    });

    const map = new Map<string, MemberData>();

    for (const d of filtered) {
      const assignees = d.demand_assignees || [];
      for (const a of assignees) {
        if (!a.profile) continue;
        if (!map.has(a.user_id)) {
          map.set(a.user_id, {
            id: a.user_id,
            name: a.profile.full_name,
            avatar: a.profile.avatar_url,
            total: 0, toStart: 0, inProgress: 0, delivered: 0, deliveryRate: 0,
          });
        }
        const m = map.get(a.user_id)!;
        m.total++;
        const status = d.demand_statuses?.name?.toLowerCase() || "";
        if (status === "entregue") m.delivered++;
        else if (status === "a iniciar") m.toStart++;
        else m.inProgress++;
      }
    }

    map.forEach(m => {
      m.deliveryRate = m.total > 0 ? Math.round((m.delivered / m.total) * 100) : 0;
    });

    const members = Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 8);
    const totalAssigned = members.reduce((a, m) => a + m.total, 0);
    const totalDelivered = members.reduce((a, m) => a + m.delivered, 0);
    const avgDeliveryRate = totalAssigned > 0 ? Math.round((totalDelivered / totalAssigned) * 100) : 0;

    return { members, totalAssigned, avgDeliveryRate };
  }, [demands, period]);

  const chartData = members.slice(0, 6);
  const barSize = isMobile ? 14 : 18;
  const rowHeight = isMobile ? 36 : 44;

  const CustomYTick = ({ x, y, payload }: any) => {
    const member = chartData.find(m => m.name === payload.value);
    if (!member) return null;
    const initials = member.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
    const displayName = isMobile
      ? member.name.split(" ").slice(0, 1).join(" ")
      : member.name.split(" ").slice(0, 2).join(" ");
    const maxLen = isMobile ? 10 : 16;
    const truncated = displayName.length > maxLen ? displayName.slice(0, maxLen) + "…" : displayName;

    return (
      <g transform={`translate(0,${y})`}>
        <foreignObject x={0} y={-10} width={isMobile ? 90 : 140} height={20}>
          <div className="flex items-center gap-1 pl-0.5">
            <Avatar className="h-4 w-4 shrink-0">
              <AvatarImage src={member.avatar || undefined} />
              <AvatarFallback className="text-[6px] bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-[9px] md:text-[10px] text-foreground truncate">{truncated}</span>
          </div>
        </foreignObject>
      </g>
    );
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="p-4 md:p-5 pb-3 md:pb-3 flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-ops-muted" />
          Análise por membro
        </CardTitle>
        <ChartPeriodSelector value={period} onChange={setPeriod} />
      </CardHeader>
      <CardContent className="flex-1 p-4 md:p-5 pt-0 md:pt-0 space-y-3">
        {chartData.length > 0 ? (
          <div className="flex flex-col 2xl:flex-row gap-4">
            {/* Left side - Chart & summary */}
            <div className="2xl:flex-[3] min-w-0 space-y-4">
              {/* Summary */}
              <dl className="grid grid-cols-3 divide-x border-y py-3">
                {[
                  { label: "Atribuídas", value: totalAssigned, color: STATUS_COLORS.toStart },
                  { label: "Em andamento", value: members.reduce((a, m) => a + m.inProgress, 0), color: STATUS_COLORS.inProgress },
                  { label: "Taxa de entrega", value: `${avgDeliveryRate}%`, color: STATUS_COLORS.delivered },
                ].map((k) => (
                  <div key={k.label} className="px-3 first:pl-0 flex flex-col gap-1">
                    <dt className="flex items-center gap-1.5 font-ops-label text-[10px] uppercase tracking-[0.14em] text-ops-muted">
                      <span className="h-1.5 w-1.5 rounded-sm" style={{ backgroundColor: k.color }} />
                      {k.label}
                    </dt>
                    <dd className="font-ops-display text-3xl font-semibold leading-none tabular-nums text-foreground">{k.value}</dd>
                  </div>
                ))}
              </dl>

              {/* Bar chart */}
              <div className="w-full overflow-x-auto -mx-1 px-1">
                <div className={isMobile ? "min-w-[260px]" : "min-w-[300px]"}>
                  <ResponsiveContainer width="100%" height={chartData.length * rowHeight + 10}>
                    <BarChart
                      layout="vertical"
                      data={chartData}
                      margin={{ top: 0, right: isMobile ? 5 : 15, left: 0, bottom: 0 }}
                      barSize={barSize}
                    >
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={CustomYTick as any} width={isMobile ? 95 : 145} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
                      <Bar dataKey="toStart" stackId="a" fill={STATUS_COLORS.toStart} name="A Iniciar" radius={[4, 0, 0, 4]} />
                      <Bar dataKey="inProgress" stackId="a" fill={STATUS_COLORS.inProgress} name="Em Andamento" />
                      <Bar dataKey="delivered" stackId="a" fill={STATUS_COLORS.delivered} name="Entregue" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* Right side - Member list (3 visible + peek of 4th) */}
            <div className="2xl:flex-[2] shrink-0 relative">
              <ul className="2xl:max-h-[260px] max-h-[220px] overflow-y-auto divide-y pr-1 pb-6 scrollbar-thin">
                {members.map(m => {
                  const initials = m.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                  const total = Math.max(1, m.toStart + m.inProgress + m.delivered);
                  return (
                    <li key={m.id} className="py-2.5 first:pt-0 grid grid-cols-[24px_1fr_auto] items-center gap-x-2.5 gap-y-1.5">
                      <Avatar className="h-6 w-6 row-span-2">
                        <AvatarImage src={m.avatar || undefined} />
                        <AvatarFallback className="text-[9px] bg-muted text-foreground">{initials}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium truncate">{m.name}</span>
                      <span className="font-ops-display text-lg font-semibold leading-none tabular-nums row-span-2 self-center">
                        {m.deliveryRate}<span className="text-xs text-ops-muted">%</span>
                      </span>
                      <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-muted gap-px" title={`A iniciar ${m.toStart} · Em andamento ${m.inProgress} · Entregues ${m.delivered}`}>
                        <span style={{ width: `${(m.toStart / total) * 100}%`, backgroundColor: STATUS_COLORS.toStart }} />
                        <span style={{ width: `${(m.inProgress / total) * 100}%`, backgroundColor: STATUS_COLORS.inProgress }} />
                        <span style={{ width: `${(m.delivered / total) * 100}%`, backgroundColor: STATUS_COLORS.delivered }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
              {/* Fade gradient to hint more content */}
              {members.length > 3 && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent rounded-b-lg" />
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Users className="h-10 w-10 opacity-30 mb-2" />
            <p className="text-xs">Nenhum membro com demandas no período</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
