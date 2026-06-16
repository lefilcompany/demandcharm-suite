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
  toStart: "#3B82F6",
  inProgress: "#F59E0B",
  delivered: "#10B981",
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
      <CardHeader className="pb-2 p-4 md:p-6 md:pb-2 space-y-2">
        <CardTitle className="text-sm md:text-base font-bold tracking-wider uppercase text-foreground text-center flex items-center justify-center gap-2">
          <Users className="h-4 w-4 md:h-5 md:w-5 text-foreground" />
          Análise por Membro
        </CardTitle>
        <ChartPeriodSelector value={period} onChange={setPeriod} className="justify-center" />
      </CardHeader>
      <CardContent className="flex-1 p-2 md:p-4 pt-1 space-y-2">
        {chartData.length > 0 ? (
          <div className="flex flex-col 2xl:flex-row gap-4">
            {/* Left side - Chart & summary */}
            <div className="2xl:flex-[3] min-w-0 space-y-3">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-center">
                  <Target className="h-3.5 w-3.5 text-blue-500 mx-auto mb-0.5" />
                  <p className="text-base md:text-lg font-bold text-blue-600 dark:text-blue-400">{totalAssigned}</p>
                  <p className="text-[8px] md:text-[10px] text-muted-foreground">Atribuídas</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-center">
                  <TrendingUp className="h-3.5 w-3.5 text-amber-500 mx-auto mb-0.5" />
                  <p className="text-base md:text-lg font-bold text-amber-600 dark:text-amber-400">{members.reduce((a, m) => a + m.inProgress, 0)}</p>
                  <p className="text-[8px] md:text-[10px] text-muted-foreground">Andamento</p>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-center">
                  <Activity className="h-3.5 w-3.5 text-emerald-500 mx-auto mb-0.5" />
                  <p className="text-base md:text-lg font-bold text-emerald-600 dark:text-emerald-400">{avgDeliveryRate}%</p>
                  <p className="text-[8px] md:text-[10px] text-muted-foreground">Entrega</p>
                </div>
              </div>

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
               <div className="2xl:max-h-[260px] max-h-[200px] overflow-y-auto space-y-2 pr-1 pb-6 scrollbar-thin">
                {members.map(m => {
                  const initials = m.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div key={m.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors gap-2">
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6 shrink-0">
                            <AvatarImage src={m.avatar || undefined} />
                            <AvatarFallback className="text-[8px] bg-primary/10 text-primary">{initials}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs font-semibold truncate">{m.name}</span>
                        </div>
                        <div className="flex items-center gap-3 pl-8 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: STATUS_COLORS.toStart }} />
                            Ini: <strong className="text-foreground">{m.toStart}</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: STATUS_COLORS.inProgress }} />
                            And: <strong className="text-foreground">{m.inProgress}</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: STATUS_COLORS.delivered }} />
                            Ent: <strong className="text-foreground">{m.delivered}</strong>
                          </span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 shrink-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold">
                        {m.deliveryRate}%
                      </Badge>
                    </div>
                  );
                })}
              </div>
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
