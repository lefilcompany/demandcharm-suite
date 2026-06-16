import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { differenceInHours } from "date-fns";
import { useMemo } from "react";

interface Demand {
  created_at: string;
  demand_statuses?: {
    name: string;
  } | null;
  updated_at: string;
  delivered_at?: string | null;
}

interface AverageCompletionTimeProps {
  demands: Demand[];
}

export function AverageCompletionTime({ demands }: AverageCompletionTimeProps) {
  const { avgHours, trend, hasData, completedCount } = useMemo(() => {
    // Filter completed demands (all time)
    const completedDemands = demands.filter(
      (d) => d.demand_statuses?.name === "Entregue"
    );

    // Calculate average completion time using delivered_at when available
    const calculateAverageTime = () => {
      if (completedDemands.length === 0) return null;

      const totalHours = completedDemands.reduce((acc, demand) => {
        const createdAt = new Date(demand.created_at);
        const completedAt = new Date(demand.delivered_at || demand.updated_at);
        return acc + differenceInHours(completedAt, createdAt);
      }, 0);

      return totalHours / completedDemands.length;
    };

    const avgHours = calculateAverageTime();

    // Calculate trend (compare last half vs previous half)
    const calculateTrend = () => {
      if (completedDemands.length < 4) return null;

      const sorted = [...completedDemands].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      const halfPoint = Math.floor(sorted.length / 2);
      const recent = sorted.slice(0, halfPoint);
      const older = sorted.slice(halfPoint);

      const recentAvg =
        recent.reduce(
          (acc, d) => acc + differenceInHours(new Date(d.delivered_at || d.updated_at), new Date(d.created_at)),
          0
        ) / recent.length;

      const olderAvg =
        older.reduce(
          (acc, d) => acc + differenceInHours(new Date(d.delivered_at || d.updated_at), new Date(d.created_at)),
          0
        ) / older.length;

      const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100;

      return {
        direction: percentChange < -5 ? "down" : percentChange > 5 ? "up" : "stable",
        percent: Math.abs(Math.round(percentChange)),
      };
    };

    const trend = calculateTrend();

    return {
      avgHours,
      trend,
      hasData: completedDemands.length > 0,
      completedCount: completedDemands.length,
    };
  }, [demands]);

  const formatTime = (hours: number | null) => {
    if (hours === null) return { value: "-", unit: "" };

    if (hours < 24) {
      return { value: Math.round(hours), unit: "horas" };
    }

    const days = hours / 24;
    if (days < 7) {
      return { value: Math.round(days * 10) / 10, unit: "dias" };
    }

    const weeks = days / 7;
    return { value: Math.round(weeks * 10) / 10, unit: "semanas" };
  };

  const { value, unit } = formatTime(avgHours);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <CardTitle className="text-base md:text-lg flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Tempo Médio de Conclusão
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <span className="text-3xl md:text-4xl font-bold text-foreground">{value}</span>
          <span className="text-lg text-muted-foreground mb-1">{unit}</span>
        </div>

        <div className="flex items-center gap-2 mt-3">
          {trend ? (
            <>
              {trend.direction === "down" ? (
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingDown className="h-4 w-4" />
                  <span className="text-sm font-medium">{trend.percent}% mais rápido</span>
                </div>
              ) : trend.direction === "up" ? (
                <div className="flex items-center gap-1 text-red-500">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">{trend.percent}% mais lento</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Minus className="h-4 w-4" />
                  <span className="text-sm">Estável</span>
                </div>
              )}
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              {!hasData
                ? "Aguardando demandas concluídas"
                : `${completedCount} demandas concluídas`}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
