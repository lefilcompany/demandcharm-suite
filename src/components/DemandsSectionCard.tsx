import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartPeriodSelector, type ChartPeriodType, getChartPeriodRange } from "@/components/ChartPeriodSelector";
import { useState, useMemo } from "react";
import { Grid2X2, Atom, LayoutList } from "lucide-react";
import { toast } from "sonner";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { format, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useServices } from "@/hooks/useServices";
import { useBoardStatuses } from "@/hooks/useBoardStatuses";

interface Demand {
  id: string;
  created_at: string;
  delivered_at?: string | null;
  demand_statuses?: { name: string; color?: string } | null;
  services?: { id?: string; name: string } | null;
  service_id?: string | null;
}

interface DemandsSectionCardProps {
  demands: Demand[];
}

interface ServiceLookup {
  id: string;
  name: string;
  parent_id: string | null;
}

const COLORS = ["#F97316", "#8B5CF6", "#EC4899", "#7C3AED", "#06B6D4", "#84CC16", "#EF4444", "#F59E0B"];
const FALLBACK_SERVICE_LABEL = "Sem serviço";

const STATUS_CHART_COLORS: Record<string, string> = {
  "Solicitadas": "#D1D5DB",
  "A Iniciar": "#3B82F6",
  "Em Andamento": "#F59E0B",
  "Entregue": "#10B981",
};

// Extended palette for detailed statuses
const DETAILED_STATUS_COLORS = [
  "#3B82F6", "#F59E0B", "#8B5CF6", "#06B6D4", "#EC4899",
  "#10B981", "#EF4444", "#84CC16", "#F97316", "#7C3AED",
];

const CustomPieTooltip = ({ active, payload, total }: any) => {
  if (active && payload?.length) {
    const item = payload[0];
    const value = Number(item?.value ?? 0);
    const percent = total > 0 ? Math.round((value / total) * 100) : 0;

    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-2 text-xs">
        <p className="font-medium">{item?.name || item?.payload?.name || FALLBACK_SERVICE_LABEL}</p>
        <p className="text-muted-foreground">{value} demandas ({percent}%)</p>
      </div>
    );
  }
  return null;
};

const CustomAreaTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-2.5 min-w-[140px]">
        <p className="font-medium text-xs mb-1 text-foreground">{label}</p>
        {payload.map((entry: any, i: number) => (
          <div key={i} className="flex items-center justify-between gap-3 text-[11px]">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}</span>
            </div>
            <span className="font-medium text-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

function normalizeStatus(statusName: string): string {
  const lower = statusName.toLowerCase();
  if (lower === "entregue" || lower.includes("conclu")) return "Entregue";
  if (lower === "a iniciar" || lower.includes("pendente") || lower.includes("solicit")) return "A Iniciar";
  return "Em Andamento";
}

type TrendViewMode = "simple" | "detailed";

export function DemandsSectionCard({ demands }: DemandsSectionCardProps) {
  const [piePeriod, setPiePeriod] = useState<ChartPeriodType>("month");
  const [trendPeriod, setTrendPeriod] = useState<ChartPeriodType>("month");
  const [trendViewMode, setTrendViewMode] = useState<TrendViewMode>("simple");
  const [visibleSimpleStatuses, setVisibleSimpleStatuses] = useState<Set<string>>(new Set(["A Iniciar", "Em Andamento", "Entregue"]));
  const [visibleDetailedStatuses, setVisibleDetailedStatuses] = useState<Set<string> | null>(null);
  const isMobile = useIsMobile();
  const { selectedBoardId, currentTeamId } = useSelectedBoard();
  const { selectedTeamId } = useSelectedTeam();
  const { data: services = [] } = useServices(selectedTeamId || currentTeamId || null, selectedBoardId);
  const { data: boardStatuses } = useBoardStatuses(selectedBoardId || null);

  const servicesMap = useMemo(
    () => new Map(services.map((service) => [service.id, service] as const)),
    [services]
  );

  // Build board status info: ordered names + color map
  const boardStatusInfo = useMemo(() => {
    if (!boardStatuses || boardStatuses.length === 0) return null;
    
    const activeStatuses = boardStatuses
      .filter(bs => bs.is_active)
      .sort((a, b) => a.position - b.position);
    
    const names = activeStatuses.map(bs => bs.status.name);
    const colorMap: Record<string, string> = {};
    activeStatuses.forEach((bs, idx) => {
      colorMap[bs.status.name] = bs.status.color || DETAILED_STATUS_COLORS[idx % DETAILED_STATUS_COLORS.length];
    });
    
    return { names, colorMap };
  }, [boardStatuses]);

  // Initialize detailed visible statuses when board statuses load
  const detailedStatusNames = boardStatusInfo?.names || [];
  const currentVisibleDetailed = visibleDetailedStatuses ?? new Set(detailedStatusNames);

  const categoryData = useMemo(() => {
    const { start, end } = getChartPeriodRange(piePeriod);
    const filtered = demands.filter((d) => {
      const date = new Date(d.created_at);
      if (start && date < start) return false;
      if (date > end) return false;
      return true;
    });

    const catMap = new Map<string, number>();

    for (const demand of filtered) {
      const serviceName = demand.services?.name?.trim() || FALLBACK_SERVICE_LABEL;
      catMap.set(serviceName, (catMap.get(serviceName) || 0) + 1);
    }

    return Array.from(catMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [demands, piePeriod, servicesMap]);

  // Simple trend data (3 categories)
  const simpleTrendData = useMemo(() => {
    if (demands.length === 0) return [];
    return buildTrendData(demands, trendPeriod, "simple");
  }, [demands, trendPeriod]);

  // Detailed trend data (all board statuses)
  const detailedTrendData = useMemo(() => {
    if (demands.length === 0 || !boardStatusInfo) return [];
    return buildTrendData(demands, trendPeriod, "detailed", boardStatusInfo.names);
  }, [demands, trendPeriod, boardStatusInfo]);

  const totalPie = categoryData.reduce((total, item) => total + item.value, 0);

  const SIMPLE_STATUS_KEYS = ["A Iniciar", "Em Andamento", "Entregue"] as const;

  const activeStatusKeys = trendViewMode === "simple" ? SIMPLE_STATUS_KEYS : detailedStatusNames;
  const activeTrendData = trendViewMode === "simple" ? simpleTrendData : detailedTrendData;
  const activeVisibleSet = trendViewMode === "simple" ? visibleSimpleStatuses : currentVisibleDetailed;
  const activeColorMap = trendViewMode === "simple" ? STATUS_CHART_COLORS : (boardStatusInfo?.colorMap || {});

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2 p-4 md:p-6 md:pb-2">
        <CardTitle className="text-sm md:text-base font-bold tracking-wider uppercase text-foreground text-center flex items-center justify-center gap-2">
          <LayoutList className="h-4 w-4 md:h-5 md:w-5 text-foreground" />
          Demandas
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-3 md:p-6 pt-2 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
          <div className="p-3 md:p-4 rounded-xl border border-border/50 bg-card space-y-2">
            <div className="flex items-center gap-2">
              <Grid2X2 className="h-4 w-4 md:h-5 md:w-5 text-orange-500 shrink-0" />
              <span className="text-xs md:text-sm font-semibold text-foreground">Por categoria</span>
            </div>
            {categoryData.length > 0 ? (
              <div className="flex flex-col items-center gap-2">
                <div className="flex-shrink-0" style={{ width: isMobile ? 140 : 170, height: isMobile ? 140 : 170 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        cx="50%"
                        cy="50%"
                        outerRadius={isMobile ? 60 : 75}
                        dataKey="value"
                        strokeWidth={2}
                        stroke="hsl(var(--background))"
                      >
                        {categoryData.map((_, idx) => (
                          <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip total={totalPie} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {categoryData.length > 4 ? (() => {
                  const maxLen = Math.max(...categoryData.map(c => c.name.length));
                  const sizeClass = maxLen > 12 ? "text-[9px] md:text-[10px]" : "text-[10px] md:text-xs";
                  return (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0 w-full">
                      {categoryData.map((item, idx) => (
                        <div
                          key={item.name}
                          className={`flex items-center gap-1.5 ${sizeClass} py-1 border-b border-border/40 last:border-b-0 [&:nth-last-child(2):nth-child(odd)]:border-b-0 min-w-0`}
                          title={`${item.name} (${item.value})`}
                        >
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="text-foreground font-medium leading-tight truncate min-w-0 flex-1">
                            {item.name} <span className="text-muted-foreground">({item.value})</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })() : (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center w-full">
                    {categoryData.map((item, idx) => (
                      <div key={item.name} className="flex items-center gap-1.5 text-[10px] md:text-xs">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span className="text-foreground font-medium">{item.name} ({item.value})</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-[120px] text-xs text-muted-foreground">
                Sem dados no período
              </div>
            )}
            <ChartPeriodSelector value={piePeriod} onChange={setPiePeriod} className="justify-center" compact />
          </div>

          <div className="p-3 md:p-4 rounded-xl border border-border/50 bg-card space-y-2">
            {/* Header with view mode toggle */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Atom className="h-4 w-4 md:h-5 md:w-5 text-orange-500 shrink-0" />
                <span className="text-xs md:text-sm font-semibold text-foreground">Visão geral</span>
              </div>
              {boardStatusInfo && boardStatusInfo.names.length > 0 && (
                <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/50">
                  <button
                    type="button"
                    onClick={() => setTrendViewMode("simple")}
                    className={`text-[10px] px-2 py-0.5 rounded-md transition-all ${
                      trendViewMode === "simple"
                        ? "bg-background text-foreground font-medium shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Resumo
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTrendViewMode("detailed");
                      // Initialize if first time
                      if (!visibleDetailedStatuses) {
                        setVisibleDetailedStatuses(new Set(detailedStatusNames));
                      }
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded-md transition-all ${
                      trendViewMode === "detailed"
                        ? "bg-background text-foreground font-medium shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Detalhado
                  </button>
                </div>
              )}
            </div>

            {activeTrendData.length > 1 ? (
              <>
                <ResponsiveContainer width="100%" height={isMobile ? 130 : 160}>
                  <AreaChart data={activeTrendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      allowDecimals={false}
                      label={{ value: "DEMANDAS", angle: -90, position: "insideLeft", offset: 15, style: { fontSize: 8, fill: "hsl(var(--muted-foreground))" } }}
                    />
                    <Tooltip content={<CustomAreaTooltip />} />
                    {activeStatusKeys.filter((key) => activeVisibleSet.has(key)).map((key, idx) => (
                      <Area
                        key={key}
                        type="monotone"
                        dataKey={key}
                        stroke={activeColorMap[key] || DETAILED_STATUS_COLORS[idx % DETAILED_STATUS_COLORS.length]}
                        fill={activeColorMap[key] || DETAILED_STATUS_COLORS[idx % DETAILED_STATUS_COLORS.length]}
                        fillOpacity={0.15}
                        strokeWidth={2}
                        dot={{ r: 2, fill: activeColorMap[key] || DETAILED_STATUS_COLORS[idx % DETAILED_STATUS_COLORS.length] }}
                        activeDot={{ r: 4 }}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-1 gap-y-1 justify-center">
                  {activeStatusKeys.map((key) => {
                    const isActive = activeVisibleSet.has(key);
                    const color = activeColorMap[key] || DETAILED_STATUS_COLORS[activeStatusKeys.indexOf(key) % DETAILED_STATUS_COLORS.length];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (trendViewMode === "simple") {
                            setVisibleSimpleStatuses((prev) => {
                              const next = new Set(prev);
                              if (next.has(key)) {
                                if (next.size > 1) {
                                  next.delete(key);
                                } else {
                                  toast.error("Não é possível remover todos os status", {
                                    description: "Mantenha pelo menos um status visível no gráfico.",
                                  });
                                }
                              } else {
                                next.add(key);
                              }
                              return next;
                            });
                          } else {
                            setVisibleDetailedStatuses((prev) => {
                              const current = prev ?? new Set(detailedStatusNames);
                              const next = new Set(current);
                              if (next.has(key)) {
                                if (next.size > 1) {
                                  next.delete(key);
                                } else {
                                  toast.error("Não é possível remover todos os status", {
                                    description: "Mantenha pelo menos um status visível no gráfico.",
                                  });
                                }
                              } else {
                                next.add(key);
                              }
                              return next;
                            });
                          }
                        }}
                        className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                          isActive
                            ? "border-border bg-muted/60 text-foreground font-medium"
                            : "border-transparent bg-transparent text-muted-foreground/50 line-through"
                        }`}
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0 transition-opacity"
                          style={{
                            backgroundColor: color,
                            opacity: isActive ? 1 : 0.3,
                          }}
                        />
                        <span>{key}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[130px] text-xs text-muted-foreground">
                Sem dados suficientes no período
              </div>
            )}
            <ChartPeriodSelector value={trendPeriod} onChange={setTrendPeriod} className="justify-center" compact />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Builds trend data for both simple and detailed modes */
function buildTrendData(
  demands: Demand[],
  period: ChartPeriodType,
  mode: "simple" | "detailed",
  detailedStatusNames?: string[]
): Record<string, any>[] {
  const { start, end } = getChartPeriodRange(period);
  const periodStart = start || new Date(Math.min(...demands.map((d) => new Date(d.created_at).getTime())));

  const diffDays = Math.ceil((end.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24));
  let intervals: Date[];
  let formatStr: string;
  let getIntervalEnd: (date: Date) => Date;

  if (diffDays <= 31) {
    intervals = eachDayOfInterval({ start: periodStart, end });
    formatStr = "dd/MM";
    getIntervalEnd = (date) => new Date(startOfDay(date).getTime() + 86400000 - 1);
  } else if (diffDays <= 180) {
    intervals = eachWeekOfInterval({ start: periodStart, end });
    formatStr = "dd/MM";
    getIntervalEnd = (date) => new Date(startOfDay(date).getTime() + 7 * 86400000 - 1);
  } else {
    intervals = eachMonthOfInterval({ start: periodStart, end });
    formatStr = "MMM";
    getIntervalEnd = (date) => {
      return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
    };
  }

  if (mode === "simple") {
    let cumAIniciar = 0;
    let cumEmAndamento = 0;
    let cumEntregue = 0;

    return intervals.map((date, idx) => {
      const intervalEnd = idx < intervals.length - 1
        ? new Date(startOfDay(intervals[idx + 1]).getTime() - 1)
        : getIntervalEnd(date);
      const prevEnd = idx > 0
        ? new Date(startOfDay(intervals[idx]).getTime() - 1)
        : new Date(periodStart.getTime() - 1);

      for (const d of demands) {
        const created = new Date(d.created_at);
        if (created > prevEnd && created <= intervalEnd) {
          const normalized = normalizeStatus(d.demand_statuses?.name || "A Iniciar");
          if (normalized === "A Iniciar") cumAIniciar++;
          else if (normalized === "Em Andamento") cumEmAndamento++;
        }
      }

      for (const d of demands) {
        if (!d.delivered_at) continue;
        const delivered = new Date(d.delivered_at);
        if (delivered > prevEnd && delivered <= intervalEnd) {
          cumEntregue++;
        }
      }

      return {
        label: format(date, formatStr, { locale: ptBR }),
        "A Iniciar": cumAIniciar,
        "Em Andamento": cumEmAndamento,
        Entregue: cumEntregue,
      };
    });
  }

  // Detailed mode: track each board status individually
  const statusNames = detailedStatusNames || [];
  const cumulative: Record<string, number> = {};
  statusNames.forEach(name => { cumulative[name] = 0; });

  return intervals.map((date, idx) => {
    const intervalEnd = idx < intervals.length - 1
      ? new Date(startOfDay(intervals[idx + 1]).getTime() - 1)
      : getIntervalEnd(date);
    const prevEnd = idx > 0
      ? new Date(startOfDay(intervals[idx]).getTime() - 1)
      : new Date(periodStart.getTime() - 1);

    for (const d of demands) {
      const created = new Date(d.created_at);
      if (created > prevEnd && created <= intervalEnd) {
        const statusName = d.demand_statuses?.name || "A Iniciar";
        // Match to exact board status name
        if (statusName in cumulative) {
          cumulative[statusName]++;
        }
      }
    }

    const point: Record<string, any> = {
      label: format(date, formatStr, { locale: ptBR }),
    };
    statusNames.forEach(name => {
      point[name] = cumulative[name];
    });

    return point;
  });
}
