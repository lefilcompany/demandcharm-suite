import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useMemo, useState } from "react";
import { format, eachDayOfInterval, eachMonthOfInterval, startOfDay, subDays, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartPeriodSelector, type ChartPeriodType, getChartPeriodRange } from "./ChartPeriodSelector";
import { toLocalDateString } from "@/lib/dateUtils";

interface AdjustmentTrendChartProps {
  boardId: string;
}

interface AdjustmentData {
  id: string;
  created_at: string;
  metadata: {
    adjustment_type?: string;
  } | null;
  demands: {
    board_id: string;
  } | null;
}

export function AdjustmentTrendChart({ boardId }: AdjustmentTrendChartProps) {
  const [period, setPeriod] = useState<ChartPeriodType>("month");

  const { data: adjustments, isLoading } = useQuery({
    queryKey: ["adjustment-trend-all", boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_interactions")
        .select(`
          id,
          created_at,
          metadata,
          demands!inner(board_id)
        `)
        .eq("interaction_type", "adjustment_request")
        .eq("demands.board_id", boardId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as AdjustmentData[];
    },
    enabled: !!boardId,
  });

  const { totalAdjustments, internalCount, externalCount, chartData, periodDescription } = useMemo(() => {
    if (!adjustments || adjustments.length === 0) {
      return {
        totalAdjustments: 0,
        internalCount: 0,
        externalCount: 0,
        chartData: [],
        periodDescription: "Nenhum ajuste encontrado",
      };
    }

    const { start, end } = getChartPeriodRange(period);
    const today = startOfDay(end);

    // Filter adjustments by period using Date object (respects local timezone)
    const filteredAdjustments = adjustments.filter((a) => {
      const adjustmentDate = new Date(a.created_at);
      if (start && adjustmentDate < start) return false;
      if (adjustmentDate > end) return false;
      return true;
    });

    // Find effective start date
    const effectiveStart = start || 
      (filteredAdjustments.length > 0 
        ? startOfDay(new Date(filteredAdjustments[0].created_at))
        : subDays(today, 29));

    // Count by type for filtered adjustments
    let internal = 0;
    let external = 0;
    filteredAdjustments.forEach((a) => {
      const type = a.metadata?.adjustment_type;
      if (type === "internal") internal++;
      else external++;
    });

    // Determine granularity based on period
    const daysDiff = Math.ceil((today.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24));

    let data: { date: string; fullDate: string; interno: number; externo: number; total: number }[] = [];

    if (daysDiff <= 90) {
      // Daily granularity for up to 3 months (user preference: always daily when possible)
      const days = eachDayOfInterval({ start: effectiveStart, end: today });

      data = days.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayInternalAdjustments = filteredAdjustments.filter((a) => {
          const adjustmentLocalDate = toLocalDateString(a.created_at);
          const type = a.metadata?.adjustment_type;
          return adjustmentLocalDate === dayStr && type === "internal";
        }).length;
        const dayExternalAdjustments = filteredAdjustments.filter((a) => {
          const adjustmentLocalDate = toLocalDateString(a.created_at);
          const type = a.metadata?.adjustment_type;
          return adjustmentLocalDate === dayStr && type !== "internal";
        }).length;

        return {
          date: format(day, "dd/MM", { locale: ptBR }),
          fullDate: format(day, "dd 'de' MMMM", { locale: ptBR }),
          interno: dayInternalAdjustments,
          externo: dayExternalAdjustments,
          total: dayInternalAdjustments + dayExternalAdjustments,
        };
      });
    } else {
      // Monthly granularity for periods > 90 days
      const months = eachMonthOfInterval({ start: effectiveStart, end: today });

      data = months.map((monthStart) => {
        const monthEnd = endOfMonth(monthStart);
        const effectiveMonthEnd = monthEnd > today ? today : monthEnd;

        const monthInternalAdjustments = filteredAdjustments.filter((a) => {
          const adjustmentDate = new Date(a.created_at);
          const type = a.metadata?.adjustment_type;
          return adjustmentDate >= monthStart && adjustmentDate <= effectiveMonthEnd && type === "internal";
        }).length;
        const monthExternalAdjustments = filteredAdjustments.filter((a) => {
          const adjustmentDate = new Date(a.created_at);
          const type = a.metadata?.adjustment_type;
          return adjustmentDate >= monthStart && adjustmentDate <= effectiveMonthEnd && type !== "internal";
        }).length;

        return {
          date: format(monthStart, "MMM/yy", { locale: ptBR }),
          fullDate: format(monthStart, "MMMM 'de' yyyy", { locale: ptBR }),
          interno: monthInternalAdjustments,
          externo: monthExternalAdjustments,
          total: monthInternalAdjustments + monthExternalAdjustments,
        };
      });
    }

    const descriptions: Record<ChartPeriodType, string> = {
      month: "Ajustes solicitados neste mês",
      "3months": "Ajustes solicitados nos últimos 3 meses",
      "6months": "Ajustes solicitados nos últimos 6 meses",
      year: "Ajustes solicitados no último ano",
      all: "Histórico completo de solicitações de ajuste",
    };

    return {
      totalAdjustments: filteredAdjustments.length,
      internalCount: internal,
      externalCount: external,
      chartData: data,
      periodDescription: descriptions[period],
    };
  }, [adjustments, period]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-l-4 border-l-purple-500">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-purple-500" />
                Ajustes Solicitados
              </CardTitle>
              <CardDescription>{periodDescription}</CardDescription>
            </div>
            <div className="text-right space-y-1">
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                {totalAdjustments}
              </div>
            </div>
          </div>
          <ChartPeriodSelector value={period} onChange={setPeriod} />
        </div>
      </CardHeader>
      <CardContent>
        {totalAdjustments === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
            <RefreshCw className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Nenhum ajuste solicitado no período selecionado</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                labelFormatter={(_, payload) => {
                  if (payload && payload[0]) {
                    return payload[0].payload.fullDate;
                  }
                  return "";
                }}
                formatter={(value: number, name: string) => {
                  const label = name === "interno" ? "Ajustes Internos" : "Ajustes Externos";
                  return [`${value} ${value === 1 ? "ajuste" : "ajustes"}`, label];
                }}
              />
              <Legend
                formatter={(value) => (value === "interno" ? "Internos" : "Externos")}
                iconType="circle"
                iconSize={8}
              />
              <Line
                type="monotone"
                dataKey="interno"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3, fill: "#3b82f6" }}
                activeDot={{ r: 5 }}
                name="interno"
              />
              <Line
                type="monotone"
                dataKey="externo"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ r: 3, fill: "#f59e0b" }}
                activeDot={{ r: 5 }}
                name="externo"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
