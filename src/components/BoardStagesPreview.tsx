import { useTranslation } from "react-i18next";
import { ListOrdered, Eye, EyeOff, Lock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  useAllBoardStatuses,
  isFixedBoundaryStatus,
  BOARD_ROLES,
} from "@/hooks/useBoardStatuses";
import { KanbanStagesManager } from "@/components/KanbanStagesManager";
import { cn } from "@/lib/utils";

interface BoardStagesPreviewProps {
  boardId: string;
  canEdit?: boolean;
}

const adjustmentLabels: Record<string, string> = {
  internal: "Aprovação interna",
  external: "Aprovação externa",
};

export function BoardStagesPreview({ boardId, canEdit = false }: BoardStagesPreviewProps) {
  const { data: stages, isLoading } = useAllBoardStatuses(boardId);

  const sorted = (stages ?? []).slice().sort((a, b) => a.position - b.position);
  const activeCount = sorted.filter((s) => s.is_active).length;

  return (
    <Card className="col-span-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <ListOrdered className="h-5 w-5 shrink-0" />
              Etapas do Quadro
            </CardTitle>
            <CardDescription>
              {activeCount} ativas de {sorted.length} configuradas — gerencie aqui sem precisar abrir o Kanban
            </CardDescription>
          </div>
          {canEdit && <KanbanStagesManager boardId={boardId} />}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhuma etapa configurada para este quadro ainda.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {sorted.map((bs, idx) => {
              const isFixed = isFixedBoundaryStatus(bs.status.name);
              const adj = bs.adjustment_type && bs.adjustment_type !== "none" ? bs.adjustment_type : null;
              const restrictedRoles = bs.visible_to_roles && bs.visible_to_roles.length > 0
                ? bs.visible_to_roles
                : null;

              return (
                <div
                  key={bs.id}
                  className={cn(
                    "relative border rounded-xl p-3 bg-card shadow-sm transition-all hover:shadow-md flex flex-col gap-2",
                    !bs.is_active && "opacity-60",
                    isFixed && "border-primary/40 bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-flex items-center justify-center text-[10px] font-bold w-5 h-5 rounded-full bg-muted text-muted-foreground shrink-0"
                        title={`Posição ${idx + 1}`}
                      >
                        {idx + 1}
                      </span>
                      <span
                        className="h-3 w-3 rounded-full shrink-0 border"
                        style={{ backgroundColor: bs.status.color || "#6B7280" }}
                      />
                      <span className="font-semibold text-sm truncate">{bs.status.name}</span>
                    </div>
                    {isFixed && (
                      <Lock className="h-3.5 w-3.5 text-primary shrink-0" />
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant={bs.is_active ? "default" : "secondary"}
                      className="text-[10px] gap-1 h-5"
                    >
                      {bs.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {bs.is_active ? "Ativa" : "Inativa"}
                    </Badge>
                    {adj && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        {adjustmentLabels[adj]}
                      </Badge>
                    )}
                    {restrictedRoles && (
                      <Badge variant="outline" className="text-[10px] h-5">
                        Visível p/ {restrictedRoles.length} cargo{restrictedRoles.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>

                  {restrictedRoles && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                      {restrictedRoles
                        .map((r) => BOARD_ROLES.find((b) => b.value === r)?.label || r)
                        .join(", ")}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
