import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, TrendingUp, Target, Activity } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useMemo } from "react";
import { ChartPeriodSelector, type ChartPeriodType, getChartPeriodRange } from "./ChartPeriodSelector";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Demand {
  id: string;
  created_at: string;
  assigned_to: string | null;
  demand_statuses: {
    name: string;
  } | null;
  demand_assignees?: {
    user_id: string;
    profile: {
      full_name: string;
      avatar_url: string | null;
    } | null;
  }[];
}

interface WorkloadDistributionChartProps {
  demands: Demand[];
}

interface MemberWorkload {
  id: string;
  name: string;
  avatar: string | null;
  total: number;
  toStart: number;
  inProgress: number;
  delivered: number;
  deliveryRate: number;
}

const STATUS_COLORS = {
  toStart: "#3B82F6",
  inProgress: "#F59E0B",
  delivered: "#10B981",
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    dataKey: string;
  }>;
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((acc, p) => acc + (p.value || 0), 0);
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3 min-w-[180px]">
        <p className="font-semibold mb-2 text-foreground">{label}</p>
        <div className="space-y-1.5">
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">{entry.name}:</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="font-medium text-foreground">{entry.value}</span>
                <span className="text-muted-foreground text-xs">
                  ({total > 0 ? Math.round((entry.value / total) * 100) : 0}%)
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border mt-2 pt-2 flex justify-between text-sm">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-semibold text-foreground">{total} demandas</span>
        </div>
      </div>
    );
  }
  return null;
};

const CustomLegend = () => (
  <div className="flex items-center justify-center gap-6 mb-4 flex-wrap">
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.toStart }} />
      <span className="text-sm text-muted-foreground">A Iniciar</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.inProgress }} />
      <span className="text-sm text-muted-foreground">Em Andamento</span>
    </div>
    <div className="flex items-center gap-2">
      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS.delivered }} />
      <span className="text-sm text-muted-foreground">Entregue</span>
    </div>
  </div>
);

export function WorkloadDistributionChart({ demands }: WorkloadDistributionChartProps) {
  const isMobile = useIsMobile();
  const [period, setPeriod] = useState<ChartPeriodType>("month");

  const { workloadData, hasData, totalDemands, avgDeliveryRate, avgInProgress } = useMemo(() => {
    const { start, end } = getChartPeriodRange(period);

    // Filter demands by period using Date object (respects local timezone)
    const filteredDemands = demands.filter((d) => {
      const demandDate = new Date(d.created_at);
      if (start && demandDate < start) return false;
      if (demandDate > end) return false;
      return true;
    });

    // Calculate workload per member
    const workloadMap = new Map<string, MemberWorkload>();

    filteredDemands.forEach((demand) => {
      const assignees = demand.demand_assignees || [];

      assignees.forEach((assignee) => {
        if (!assignee.profile) return;

        const id = assignee.user_id;
        const { full_name, avatar_url } = assignee.profile;

        if (!workloadMap.has(id)) {
          workloadMap.set(id, {
            id,
            name: full_name,
            avatar: avatar_url,
            total: 0,
            toStart: 0,
            inProgress: 0,
            delivered: 0,
            deliveryRate: 0,
          });
        }

        const member = workloadMap.get(id)!;
        member.total += 1;

        const statusName = demand.demand_statuses?.name?.toLowerCase() || "";
        if (statusName === "entregue") {
          member.delivered += 1;
        } else if (statusName === "a iniciar") {
          member.toStart += 1;
        } else {
          member.inProgress += 1;
        }
      });
    });

    // Calculate delivery rates
    workloadMap.forEach((member) => {
      member.deliveryRate = member.total > 0 ? Math.round((member.delivered / member.total) * 100) : 0;
    });

    const workloadData = Array.from(workloadMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    const hasData = workloadData.length > 0;

    // Summary metrics
    const totalDemands = workloadData.reduce((acc, m) => acc + m.total, 0);
    const totalDelivered = workloadData.reduce((acc, m) => acc + m.delivered, 0);
    const avgDeliveryRate = totalDemands > 0 ? Math.round((totalDelivered / totalDemands) * 100) : 0;
    const avgInProgress = workloadData.length > 0
      ? Math.round(workloadData.reduce((acc, m) => acc + m.inProgress, 0) / workloadData.length)
      : 0;

    return { workloadData, hasData, totalDemands, avgDeliveryRate, avgInProgress };
  }, [demands, period]);

  // Responsive chart dimensions
  const yAxisWidth = isMobile ? 100 : 170;
  const barSize = isMobile ? 16 : 20;
  const rowHeight = isMobile ? 40 : 50;

  // Custom Y-axis tick with avatar - responsive
  const CustomYAxisTick = ({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
    const member = workloadData.find((m) => m.name === payload.value);
    if (!member) return null;

    const initials = member.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    // Truncate name for mobile
    const displayName = isMobile 
      ? member.name.split(" ").slice(0, 2).join(" ")
      : member.name;
    const maxNameLength = isMobile ? 12 : 20;
    const truncatedName = displayName.length > maxNameLength 
      ? displayName.slice(0, maxNameLength) + "..." 
      : displayName;

    return (
      <g transform={`translate(0,${y})`}>
        <foreignObject x={0} y={-12} width={yAxisWidth - 10} height={24}>
          <div className="flex items-center gap-1.5 justify-start pl-1">
            <Avatar className={isMobile ? "h-4 w-4 shrink-0" : "h-5 w-5 shrink-0"}>
              <AvatarImage src={member.avatar || undefined} />
              <AvatarFallback className={`${isMobile ? "text-[6px]" : "text-[8px]"} bg-primary/10 text-primary`}>
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className={`${isMobile ? "text-[10px]" : "text-xs"} text-foreground truncate`} title={member.name}>
              {truncatedName}
            </span>
          </div>
        </foreignObject>
      </g>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Carga de Trabalho por Membro
          </CardTitle>
          <ChartPeriodSelector value={period} onChange={setPeriod} />
        </div>
      </CardHeader>
      <CardContent>
        {hasData ? (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 sm:p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
                  <Target className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
                </div>
                <p className="text-lg sm:text-xl font-bold text-blue-600 dark:text-blue-400">{totalDemands}</p>
                <p className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight">Atribuídas</p>
              </div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 sm:p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
                  <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-500" />
                </div>
                <p className="text-lg sm:text-xl font-bold text-emerald-600 dark:text-emerald-400">{avgDeliveryRate}%</p>
                <p className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight">Entrega</p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 sm:p-3 text-center">
                <div className="flex items-center justify-center gap-1 mb-0.5 sm:mb-1">
                  <Activity className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500" />
                </div>
                <p className="text-lg sm:text-xl font-bold text-amber-600 dark:text-amber-400">{avgInProgress}</p>
                <p className="text-[8px] sm:text-[10px] text-muted-foreground leading-tight">Andamento</p>
              </div>
            </div>

            {/* Legend */}
            <CustomLegend />

            {/* Chart and Details - Responsive Layout */}
            <div className="flex flex-col gap-4">
              {/* Stacked Bar Chart */}
              <div className="w-full overflow-x-auto -mx-2 px-2">
                <div className={isMobile ? "min-w-[280px]" : "min-w-[400px]"}>
                  <ResponsiveContainer width="100%" height={workloadData.length * rowHeight + 20}>
                    <BarChart
                      layout="vertical"
                      data={workloadData}
                      margin={{ top: 0, right: isMobile ? 10 : 20, left: isMobile ? 0 : 10, bottom: 0 }}
                      barSize={barSize}
                    >
                      <XAxis
                        type="number"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: isMobile ? 9 : 11, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        axisLine={false}
                        tickLine={false}
                        tick={CustomYAxisTick as any}
                        width={yAxisWidth}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
                      <Bar
                        dataKey="toStart"
                        stackId="a"
                        fill={STATUS_COLORS.toStart}
                        name="A Iniciar"
                        radius={[4, 0, 0, 4]}
                      />
                      <Bar
                        dataKey="inProgress"
                        stackId="a"
                        fill={STATUS_COLORS.inProgress}
                        name="Em Andamento"
                      />
                      <Bar
                        dataKey="delivered"
                        stackId="a"
                        fill={STATUS_COLORS.delivered}
                        name="Entregue"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Member Details List */}
              <div className="border-t border-border pt-3 sm:pt-4">
                <p className="text-[10px] sm:text-xs font-medium text-muted-foreground mb-2 sm:mb-3">Detalhamento por Membro</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 sm:gap-2">
                  {workloadData.map((member) => {
                    const initials = member.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();

                    return (
                      <div key={member.id} className="p-2 sm:p-3 rounded-lg border border-border/50 bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                            <Avatar className="h-5 w-5 sm:h-6 sm:w-6 shrink-0">
                              <AvatarImage src={member.avatar || undefined} />
                              <AvatarFallback className="text-[8px] sm:text-[9px] bg-primary/10 text-primary">
                                {initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs sm:text-sm font-medium truncate">{member.name}</span>
                          </div>
                          <div className="px-1.5 sm:px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                            {member.deliveryRate}%
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-xs flex-wrap">
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS.toStart }} />
                            <span className="text-muted-foreground">Ini:</span>
                            <span className="font-medium text-foreground">{member.toStart}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS.inProgress }} />
                            <span className="text-muted-foreground">And:</span>
                            <span className="font-medium text-foreground">{member.inProgress}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS.delivered }} />
                            <span className="text-muted-foreground">Ent:</span>
                            <span className="font-medium text-foreground">{member.delivered}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhum membro com demandas atribuídas no período
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
