import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Timer, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { differenceInHours } from "date-fns";
import { useBoardTimeEntries } from "@/hooks/useBoardTimeEntries";

interface Demand {
  created_at: string;
  demand_statuses?: { name: string } | null;
  updated_at: string;
  delivered_at?: string | null;
  priority?: string | null;
  service_id?: string | null;
  services?: { estimated_hours: number } | null;
}

interface ProductivitySectionProps {
  demands: Demand[];
  boardId: string | null;
}


function CompletionProgressBar({ avgDays, expectedAvgDays, maxDays }: { avgDays: number; expectedAvgDays: number | null; maxDays: number }) {
  const fillPercent = maxDays > 0 ? Math.min(100, Math.max(0, (avgDays / maxDays) * 100)) : 0;
  const markerPercent = expectedAvgDays !== null && maxDays > 0 ? Math.min(100, Math.max(0, (expectedAvgDays / maxDays) * 100)) : null;

  return (
    <div className="relative w-full">
      {/* Expected avg label above bar */}
      {markerPercent !== null && expectedAvgDays !== null && (
        <div className="relative h-16 mt-3 mb-3">
          <div
              className="absolute flex flex-col"
              style={{
                left: `${markerPercent}%`,
                transform: markerPercent > 75 ? 'translateX(-100%)' : markerPercent < 25 ? 'translateX(0)' : 'translateX(-50%)',
                alignItems: markerPercent > 75 ? 'flex-end' : markerPercent < 25 ? 'flex-start' : 'center',
              }}
            >
            <span className="text-xs sm:text-sm font-semibold text-muted-foreground whitespace-nowrap text-center leading-tight">
              Tempo médio<br />esperado:
            </span>
            <span className="whitespace-nowrap">
              <span className="text-sm sm:text-base font-bold text-foreground">{expectedAvgDays.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground ml-0.5">dias</span>
            </span>
          </div>
        </div>
      )}
      {/* Progress bar */}
      <div className="relative h-3 sm:h-3.5 md:h-4 rounded-full bg-muted overflow-visible">
        <div
          className="absolute inset-y-0 left-0 bg-orange-400 rounded-full transition-all duration-500"
          style={{ width: `${fillPercent}%` }}
        />
        {/* Expected avg vertical marker */}
        {markerPercent !== null && (
          <div
            className="absolute top-[-4px] bottom-[-4px] w-[3px] rounded-full bg-slate-800 dark:bg-white z-10 shadow-md"
            style={{ left: `${markerPercent}%`, transform: 'translateX(-50%)' }}
          />
        )}
      </div>
    </div>
  );
}


function ActivityProgressBar({ avgHoursPerMember, expectedAvgHours, maxHours }: { avgHoursPerMember: number; expectedAvgHours: number | null; maxHours: number }) {
  const fillPercent = maxHours > 0 ? Math.min(100, Math.max(0, (avgHoursPerMember / maxHours) * 100)) : 0;
  const markerPercent = expectedAvgHours !== null && maxHours > 0 ? Math.min(100, Math.max(0, (expectedAvgHours / maxHours) * 100)) : null;

  return (
    <div className="relative w-full">
      {/* Expected avg label above bar */}
        {markerPercent !== null && expectedAvgHours !== null && (
          <div className="relative h-16 mt-3 mb-3">
            <div
              className="absolute flex flex-col"
              style={{
                left: `${markerPercent}%`,
                transform: markerPercent > 75 ? 'translateX(-100%)' : markerPercent < 25 ? 'translateX(0)' : 'translateX(-50%)',
                alignItems: markerPercent > 75 ? 'flex-end' : markerPercent < 25 ? 'flex-start' : 'center',
              }}
            >
              <span className="text-xs sm:text-sm font-semibold text-muted-foreground whitespace-nowrap text-center leading-tight">
                Tempo médio<br />esperado:
              </span>
              <span className="whitespace-nowrap">
                <span className="text-sm sm:text-base font-bold text-foreground">{expectedAvgHours.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                <span className="text-[10px] sm:text-xs text-muted-foreground ml-0.5">horas</span>
              </span>
            </div>
          </div>
        )}
      {/* Progress bar */}
      <div className="relative h-3 sm:h-3.5 md:h-4 rounded-full bg-muted overflow-visible">
        <div
          className="absolute inset-y-0 left-0 bg-orange-400 rounded-full transition-all duration-500"
          style={{ width: `${fillPercent}%` }}
        />
        {/* Expected avg vertical marker */}
        {markerPercent !== null && (
          <div
            className="absolute top-[-4px] bottom-[-4px] w-[3px] rounded-full bg-slate-800 dark:bg-white z-10 shadow-md"
            style={{ left: `${markerPercent}%`, transform: 'translateX(-50%)' }}
          />
        )}
      </div>
    </div>
  );
}

export function ProductivitySection({ demands, boardId }: ProductivitySectionProps) {
  const { data: allEntries } = useBoardTimeEntries(boardId);

  const priorityWeights: Record<string, number> = { alta: 3, média: 2, baixa: 1 };

  const { avgDays, completionBenchmark, expectedAvgDays, maxDays } = useMemo(() => {
    const completedDemands = demands.filter(d => d.demand_statuses?.name === "Entregue");
    if (completedDemands.length === 0) return { avgDays: 0, completionBenchmark: 5, expectedAvgDays: null as number | null, maxDays: 9 };

    const daysList = completedDemands.map(d => {
      const created = new Date(d.created_at);
      const completed = new Date(d.delivered_at || d.updated_at);
      return differenceInHours(completed, created) / 24;
    }).sort((a, b) => a - b);

    const avg = Math.round((daysList.reduce((a, b) => a + b, 0) / daysList.length) * 10) / 10;

    const mid = Math.floor(daysList.length / 2);
    const median = daysList.length % 2 !== 0
      ? daysList[mid]
      : (daysList[mid - 1] + daysList[mid]) / 2;
    const benchmark = Math.round(median * 10) / 10 || 5;

    // Expected avg: weighted average of estimated_hours by priority, converted to business days (/8)
    const demandsWithService = demands.filter(d => d.services?.estimated_hours && d.services.estimated_hours > 0);
    let expectedAvg: number | null = null;
    if (demandsWithService.length > 0) {
      let totalWeightedHours = 0;
      let totalWeight = 0;
      for (const d of demandsWithService) {
        const weight = priorityWeights[d.priority || "baixa"] || 1;
        totalWeightedHours += (d.services!.estimated_hours) * weight;
        totalWeight += weight;
      }
      expectedAvg = totalWeight > 0 ? Math.round((totalWeightedHours / totalWeight / 8) * 10) / 10 : null;
    }

    const scale = Math.floor(avg) + 4;

    return { avgDays: avg, completionBenchmark: benchmark, expectedAvgDays: expectedAvg, maxDays: Math.max(scale, 5) };
  }, [demands]);

  const { totalActiveHours, avgActiveHoursPerUser, expectedActivityHours, activityMaxHours } = useMemo(() => {
    if (!allEntries || allEntries.length === 0) return { totalActiveHours: 0, avgActiveHoursPerUser: 0, expectedActivityHours: null as number | null, activityMaxHours: 10 };

    let totalSecs = 0;
    const uniqueUsers = new Set<string>();
    for (const entry of allEntries) {
      totalSecs += entry.duration_seconds || 0;
      uniqueUsers.add(entry.user_id);
    }
    const hours = Math.round((totalSecs / 3600) * 10) / 10;
    const numMembers = uniqueUsers.size;
    const avgPerUser = numMembers > 0 ? Math.round((totalSecs / numMembers / 3600) * 10) / 10 : 0;

    // Expected activity hours per member: Σ(estimated_hours * weight) / (Σ(weight) * numMembers)
    const demandsWithService = demands.filter(d => d.services?.estimated_hours && d.services.estimated_hours > 0);
    let expectedAvg: number | null = null;
    if (demandsWithService.length > 0 && numMembers > 0) {
      let totalWeightedHours = 0;
      let totalWeight = 0;
      for (const d of demandsWithService) {
        const weight = priorityWeights[d.priority || "baixa"] || 1;
        totalWeightedHours += d.services!.estimated_hours * weight;
        totalWeight += weight;
      }
      expectedAvg = totalWeight > 0 ? Math.round((totalWeightedHours / (totalWeight * numMembers)) * 10) / 10 : null;
    }

    const scale = Math.floor(avgPerUser) + 4;

    return { totalActiveHours: hours, avgActiveHoursPerUser: avgPerUser, expectedActivityHours: expectedAvg, activityMaxHours: Math.max(scale, 5) };
  }, [allEntries, demands]);

  const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2 p-3 sm:p-4 md:p-6 md:pb-2">
        <CardTitle className="text-xs sm:text-sm md:text-base font-bold tracking-wider uppercase text-foreground text-center flex items-center justify-center gap-2">
          <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-foreground" />
          Produtividade
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-2.5 sm:p-3 md:p-6 pt-1 sm:pt-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 md:gap-4">
          {/* Tempo médio de conclusão */}
          <div className="p-2.5 sm:p-3 md:p-4 rounded-xl border border-border/50 bg-card space-y-2 sm:space-y-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-orange-500 shrink-0" />
              <span className="text-[11px] sm:text-xs md:text-sm font-semibold text-foreground leading-tight">
                Tempo médio de conclusão
              </span>
            </div>

            <div className="flex items-baseline w-full">
              <div className="inline-flex items-baseline gap-1 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 w-full justify-center bg-primary">
                <span className="text-lg sm:text-xl md:text-2xl font-bold text-white">{avgDays > 0 ? fmt(avgDays) : "-"}</span>
                <span className="text-[10px] sm:text-xs text-white/80">dias</span>
              </div>
            </div>

            <CompletionProgressBar avgDays={avgDays} expectedAvgDays={expectedAvgDays} maxDays={maxDays} />

            <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-muted-foreground">
              <span>1 dia</span>
              <span>{maxDays} dias</span>
            </div>


          </div>

          {/* Tempo em atividade */}
          <div className="p-2.5 sm:p-3 md:p-4 rounded-xl border border-border/50 bg-card space-y-2 sm:space-y-3">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Timer className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5 text-orange-500 shrink-0" />
              <span className="text-[11px] sm:text-xs md:text-sm font-semibold text-foreground leading-tight">
                Tempo em atividade
              </span>
            </div>

            <div className="flex items-baseline w-full">
              <div className="inline-flex items-baseline gap-1 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 w-full justify-center bg-primary">
                <span className="text-lg sm:text-xl md:text-2xl font-bold text-white">{avgActiveHoursPerUser > 0 ? fmt(avgActiveHoursPerUser) : "-"}</span>
                <span className="text-[10px] sm:text-xs text-white/80">h/membro</span>
              </div>
            </div>

            <ActivityProgressBar avgHoursPerMember={avgActiveHoursPerUser} expectedAvgHours={expectedActivityHours} maxHours={activityMaxHours} />

            <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-muted-foreground">
              <span>0 horas</span>
              <span>{activityMaxHours} horas</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
