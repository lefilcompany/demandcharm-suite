import { sprintStageDistribution } from "@/lib/sprints";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  demands: { status_id?: string | null; demand_statuses?: { name?: string | null } | null }[];
  columns: { key: string; label: string; statusId?: string; color?: string }[];
}

export function SprintStageProgress({ demands, columns }: Props) {
  const { stages, other, otherPercent, total } = sprintStageDistribution(demands, columns);
  const segments = [
    ...stages.map(stage => ({ ...stage, color: stage.color || "hsl(var(--muted-foreground))" })),
    ...(other ? [{ key: "other", label: "Outras etapas", count: other, percent: otherPercent, color: "hsl(var(--muted-foreground))" }] : []),
  ];
  let offset = 0;

  return (
    <div className="space-y-2" aria-label="Situação do Kanban da sprint">
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="block h-2.5 w-full overflow-hidden rounded-full bg-muted" role="img"
        aria-label={total ? segments.filter(s => s.count).map(s => `${s.label}: ${s.count} (${Math.round(s.percent)}%)`).join("; ") : "Nenhuma demanda na sprint"}>
        {segments.filter(s => s.count > 0).map(segment => {
          const x = offset;
          offset += segment.percent;
          return <rect key={segment.key} x={x} y={0} width={segment.percent} height={10} fill={segment.color}>
            <title>{segment.label}: {segment.count} ({Math.round(segment.percent)}%)</title>
          </rect>;
        })}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {segments.map(segment => (
          <Tooltip key={segment.key}>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 8 8" className="h-2 w-2 shrink-0" aria-hidden="true"><circle cx={4} cy={4} r={4} fill={segment.color} /></svg>
                {segment.label} <span className="font-medium text-foreground">{segment.count}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>{segment.count} de {total} demanda(s) · {Math.round(segment.percent)}%</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}