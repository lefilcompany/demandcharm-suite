import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2, Lock, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { useDemandDependencyInfo } from "@/hooks/useDependencyCheck";
import { useUpdateSubdemandDependency } from "@/hooks/useSubdemands";
import { formatDemandCode } from "@/lib/demandCodeUtils";

const NONE_VALUE = "__none__";

interface Props {
  demandId: string;
  boardId: string;
  /** Restrict candidates to siblings of this parent (subdemand context) */
  parentDemandId?: string | null;
  disabled?: boolean;
}

interface CandidateDemand {
  id: string;
  title: string;
  board_sequence_number: number | null;
  parent_demand_id: string | null;
}

/**
 * Lets the user create, change or remove the dependency ("travamento") of an
 * already-created demand. Saves immediately on confirmation.
 */
export function DemandDependencyEditor({ demandId, boardId, parentDemandId, disabled }: Props) {
  const queryClient = useQueryClient();
  const { data: currentDeps, isLoading: loadingCurrent } = useDemandDependencyInfo(demandId);
  const updateDependency = useUpdateSubdemandDependency();
  const [pendingValue, setPendingValue] = useState<string>(NONE_VALUE);

  const currentDep = currentDeps?.[0] ?? null;

  useEffect(() => {
    setPendingValue(currentDep?.dependsOnDemandId ?? NONE_VALUE);
  }, [currentDep?.dependsOnDemandId]);

  // Demands from the same board (potential dependencies)
  const { data: boardDemands } = useQuery({
    queryKey: ["dependency-candidates", boardId, parentDemandId ?? null],
    queryFn: async (): Promise<CandidateDemand[]> => {
      let query = supabase
        .from("demands")
        .select("id, title, board_sequence_number, parent_demand_id")
        .eq("board_id", boardId)
        .eq("archived", false)
        .order("board_sequence_number", { ascending: true });
      if (parentDemandId) query = query.eq("parent_demand_id", parentDemandId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as CandidateDemand[];
    },
    enabled: !!boardId,
  });

  // All dependency edges — used to prevent cycles
  const { data: edges } = useQuery({
    queryKey: ["dependency-edges", boardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demand_dependencies")
        .select("demand_id, depends_on_demand_id");
      if (error) throw error;
      return (data || []) as { demand_id: string; depends_on_demand_id: string }[];
    },
    enabled: !!boardId,
  });

  /** Every demand that depends (directly or transitively) on this one. */
  const dependents = useMemo(() => {
    const set = new Set<string>();
    if (!edges) return set;
    const queue = [demandId];
    while (queue.length) {
      const current = queue.shift()!;
      for (const e of edges) {
        if (e.depends_on_demand_id === current && !set.has(e.demand_id)) {
          set.add(e.demand_id);
          queue.push(e.demand_id);
        }
      }
    }
    return set;
  }, [edges, demandId]);

  const options = useMemo(() => {
    return (boardDemands || []).filter((d) => d.id !== demandId && !dependents.has(d.id));
  }, [boardDemands, demandId, dependents]);

  const label = (d: CandidateDemand) =>
    `${d.board_sequence_number ? `${formatDemandCode(d.board_sequence_number)} ` : ""}${d.title}`;

  const save = async (next: string) => {
    try {
      await updateDependency.mutateAsync({
        demandId,
        dependsOnDemandId: next === NONE_VALUE ? null : next,
      });
      queryClient.invalidateQueries({ queryKey: ["dependency-edges", boardId] });
      toast.success(next === NONE_VALUE ? "Dependência removida" : "Dependência atualizada");
    } catch (err) {
      toast.error("Não foi possível atualizar a dependência", { description: getErrorMessage(err) });
      setPendingValue(currentDep?.dependsOnDemandId ?? NONE_VALUE);
    }
  };

  const isDirty = pendingValue !== (currentDep?.dependsOnDemandId ?? NONE_VALUE);
  const busy = updateDependency.isPending;

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/30 p-3">
      <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Link2 className="h-3.5 w-3.5" />
        Dependência
      </Label>

      {loadingCurrent ? (
        <p className="text-xs text-muted-foreground">Carregando…</p>
      ) : (
        <>
          {currentDep && (
            <div className="flex items-center gap-2 rounded-md bg-background px-2.5 py-1.5 text-xs">
              {currentDep.isBlocked ? (
                <Lock className="h-3.5 w-3.5 shrink-0 text-destructive" />
              ) : (
                <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">
                Pode iniciar quando <span className="font-semibold">{currentDep.dependsOnTitle}</span> for concluída
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="ml-auto h-6 w-6 shrink-0"
                disabled={disabled || busy}
                onClick={() => {
                  setPendingValue(NONE_VALUE);
                  void save(NONE_VALUE);
                }}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={pendingValue}
              onValueChange={setPendingValue}
              disabled={disabled || busy}
            >
              <SelectTrigger className="h-8 w-auto min-w-[220px] max-w-full flex-1">
                <SelectValue placeholder="Selecionar demanda" />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <SelectItem value={NONE_VALUE}>Nenhuma</SelectItem>
                {options.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {label(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              className="h-8"
              disabled={disabled || busy || !isDirty}
              onClick={() => void save(pendingValue)}
            >
              {busy && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {currentDep ? "Alterar" : "Definir"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            A demanda só poderá ser iniciada depois que a demanda selecionada for concluída. Demandas que dependem desta
            não aparecem na lista para evitar ciclos.
          </p>
        </>
      )}
    </div>
  );
}
