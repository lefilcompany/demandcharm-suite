import { sprintStageDistribution, sprintKanbanCompletion } from "@/lib/sprints";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, CircleDashed } from "lucide-react";

interface Props {
  demands: { status_id?: string | null; demand_statuses?: { name?: string | null } | null }[];
  columns: { key: string; label: string; statusId?: string; color?: string }[];
}

function StageColor({ color, x = 0, width = 8, height = 8 }: { color: string; x?: number; width?: number; height?: number }) {
  if (color.startsWith("bg-")) {
    return <foreignObject x={x} y={0} width={width} height={height}>
      <div className={`h-full w-full ${color.replace(/\/\d+$/, "/100")}`} />
    </foreignObject>;
  }
  return <rect x={x} y={0} width={width} height={height} fill={color} />;
}

export function SprintStageProgress({ demands, columns }: Props) {
  const { stages, other, otherPercent, total } = sprintStageDistribution(demands, columns);
  const { delivered, remaining, percent } = sprintKanbanCompletion(demands, columns);
  const segments = [
    ...stages.map(stage => ({ ...stage, color: stage.color || "hsl(var(--muted-foreground))" })),
    ...(other ? [{ key: "other", label: "Outras etapas", count: other, percent: otherPercent, color: "hsl(var(--muted-foreground))" }] : []),
  ];
  let offset = 0;

  return (
    <div className="space-y-4 border-t border-border pt-4" aria-label="Situação do Kanban da sprint">
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums text-foreground">{percent}%</span>
            <span className="text-sm text-muted-foreground">concluído</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 className="h-3.5 w-3.5" />{delivered} de {total} entregues</span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground"><CircleDashed className="h-3.5 w-3.5" />{remaining} pendente{remaining === 1 ? "" : "s"}</span>
          </div>
        </div>
        <Progress value={percent} aria-label="Progresso concluído da sprint" className="h-3 bg-muted" indicatorClassName="bg-success motion-reduce:transition-none" />
      </div>
      <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span className="font-medium">Distribuição por etapa</span><span className="tabular-nums">{total} demanda{total === 1 ? "" : "s"}</span></div>
      <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="block h-2 w-full overflow-hidden rounded-full bg-muted" role="img"
        aria-label={total ? segments.filter(s => s.count).map(s => `${s.label}: ${s.count} (${Math.round(s.percent)}%)`).join("; ") : "Nenhuma demanda na sprint"}>
        {segments.filter(s => s.count > 0).map(segment => {
          const x = offset;
          offset += segment.percent;
          return <g key={segment.key}>
            <StageColor x={x} width={segment.percent} height={10} color={segment.color} />
            <title>{segment.label}: {segment.count} ({Math.round(segment.percent)}%)</title>
          </g>;
        })}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {segments.filter(segment => segment.count > 0).map(segment => (
          <Tooltip key={segment.key}>
            <TooltipTrigger asChild>
              <span className="inline-flex items-center gap-1.5">
                <svg viewBox="0 0 8 8" className="h-2 w-2 shrink-0 overflow-hidden rounded-full" aria-hidden="true"><StageColor color={segment.color} /></svg>
                {segment.label} <span className="font-medium tabular-nums text-foreground">{segment.count}</span><span className="tabular-nums">({Math.round(segment.percent)}%)</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>{segment.count} de {total} demanda(s) · {Math.round(segment.percent)}%</TooltipContent>
          </Tooltip>
        ))}
        {total === 0 && <span>Nenhuma demanda nesta sprint</span>}
      </div>
      </div>
    </div>
  );
}