import { Zap } from "lucide-react";
import { ActiveDemandCard } from "@/components/ActiveDemandCard";
import { BoardTimeEntry } from "@/hooks/useBoardTimeEntries";

interface ActiveDemandData {
  entry: BoardTimeEntry;
  totalSeconds: number;
}

interface ActiveWorkSectionProps {
  activeDemands: ActiveDemandData[];
}

export function ActiveWorkSection({ activeDemands }: ActiveWorkSectionProps) {
  if (activeDemands.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-emerald-500/10">
          <Zap className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Trabalhando Agora
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {activeDemands.length} demanda{activeDemands.length !== 1 ? 's' : ''} sendo trabalhada{activeDemands.length !== 1 ? 's' : ''} agora
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeDemands.slice(0, 6).map(({ entry, totalSeconds }) => (
          <ActiveDemandCard 
            key={entry.demand_id} 
            entry={entry} 
            demandTotalSeconds={totalSeconds} 
          />
        ))}
      </div>
      
      {activeDemands.length > 6 && (
        <p className="text-sm text-muted-foreground text-center">
          E mais {activeDemands.length - 6} demanda(s) ativa(s)...
        </p>
      )}
    </div>
  );
}
