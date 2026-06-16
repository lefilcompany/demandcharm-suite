import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";
import { ChartPeriodSelector, type ChartPeriodType, getChartPeriodRange } from "./ChartPeriodSelector";

interface PriorityDistributionChartProps {
  demands: Array<{
    priority: string | null;
    created_at: string;
  }>;
}

const PRIORITY_COLORS: Record<string, string> = {
  alta: "#dc2626",
  média: "#f97316",
  baixa: "#10b981",
  high: "#dc2626",
  medium: "#f97316",
  low: "#10b981",
  null: "#94a3b8",
};

const PRIORITY_LABELS: Record<string, string> = {
  alta: "Alta",
  média: "Média",
  baixa: "Baixa",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
  null: "Sem prioridade",
};

export function PriorityDistributionChart({ demands }: PriorityDistributionChartProps) {
  const [period, setPeriod] = useState<ChartPeriodType>("month");

  const { data, hasData, periodDescription } = useMemo(() => {
    const { start, end } = getChartPeriodRange(period);

    // Filter demands by period using Date object (respects local timezone)
    const filteredDemands = demands.filter((d) => {
      const demandDate = new Date(d.created_at);
      if (start && demandDate < start) return false;
      if (demandDate > end) return false;
      return true;
    });

    const priorityCounts = filteredDemands.reduce((acc, demand) => {
      const priority = demand.priority || "null";
      acc[priority] = (acc[priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const rawData = Object.entries(priorityCounts).map(([priority, count]) => ({
      name: PRIORITY_LABELS[priority] || priority,
      value: count,
      color: PRIORITY_COLORS[priority] || "#6b7280",
    }));

    const hasData = rawData.length > 0;

    const emptyData = [{ name: "Sem dados", value: 1, color: "#e5e7eb" }];

    const descriptions: Record<ChartPeriodType, string> = {
      month: "Prioridades neste mês",
      "3months": "Prioridades nos últimos 3 meses",
      "6months": "Prioridades nos últimos 6 meses",
      year: "Prioridades no último ano",
      all: "Prioridades de todo o período",
    };

    return {
      data: hasData ? rawData : emptyData,
      hasData,
      periodDescription: descriptions[period],
    };
  }, [demands, period]);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Distribuição por Prioridade
            </CardTitle>
          </div>
          <ChartPeriodSelector value={period} onChange={setPeriod} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {!hasData && (
            <div className="absolute inset-0 flex items-center justify-center z-10">
              <span className="text-muted-foreground text-sm bg-background/80 px-3 py-1 rounded-md">
                Sem demandas no período
              </span>
            </div>
          )}
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={hasData ? 2 : 0}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} opacity={hasData ? 1 : 0.3} />
                ))}
              </Pie>
              {hasData && (
                <Tooltip
                  formatter={(value: number) => [`${value} demandas`, ""]}
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
              )}
              {hasData && (
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                />
              )}
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
