import { useEffect, useState } from "react";
import { Link2Off, CheckCircle2, Lock } from "lucide-react";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/errorUtils";

interface BlockingDep {
  /** PK of the demand_dependencies row */
  id: string;
  /** Demand we depend on */
  dependsOnDemandId: string;
  dependsOnTitle: string;
  /** Status name of the depends_on demand */
  dependsOnStatusName: string;
}

interface DependentDep {
  /** PK of the demand_dependencies row */
  id: string;
  /** Demand that depends on us */
  demandId: string;
  demandTitle: string;
}

interface Props {
  /** The demand whose 3-dot menu is being rendered */
  demandId: string;
  /** Whether the current demand is already in "Entregue" status */
  isDelivered?: boolean;
  /** Optional close handler triggered after a successful action */
  onActionDone?: () => void;
  /**
   * When true, renders a disabled "Sem dependências" hint instead of
   * returning null when there are no incoming/outgoing deps. Use this when
   * the menu would otherwise be empty (e.g. dedicated dependency dropdown).
   */
  showEmptyHint?: boolean;
}

/**
 * Renders contextual dependency actions inside a demand's three-dot menu.
 *
 * Two roles are surfaced when applicable:
 * - Dependent (this demand depends on another): unlink the dependency, OR
 *   mark the blocking demand as delivered (which automatically clears the
 *   block).
 * - Blocker (other demands depend on this one): mark THIS demand as
 *   delivered to unblock everyone, OR remove the inbound dependency links.
 */
export function DependencyMenuItems({ demandId, isDelivered, onActionDone, showEmptyHint }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [blocking, setBlocking] = useState<BlockingDep[]>([]);
  const [dependents, setDependents] = useState<DependentDep[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        // Demands this one depends on
        const { data: outgoing } = await supabase
          .from("demand_dependencies")
          .select(`
            id,
            depends_on_demand_id,
            depends_on:demands!demand_dependencies_depends_on_demand_id_fkey(
              id, title, demand_statuses(name)
            )
          `)
          .eq("demand_id", demandId);

        // Demands that depend on this one
        const { data: incoming } = await supabase
          .from("demand_dependencies")
          .select(`
            id,
            demand_id,
            dependent:demands!demand_dependencies_demand_id_fkey(id, title)
          `)
          .eq("depends_on_demand_id", demandId);

        if (!active) return;

        setBlocking(
          (outgoing || []).map((row: any) => ({
            id: row.id,
            dependsOnDemandId: row.depends_on_demand_id,
            dependsOnTitle: row.depends_on?.title ?? "Desconhecida",
            dependsOnStatusName: row.depends_on?.demand_statuses?.name ?? "",
          }))
        );
        setDependents(
          (incoming || []).map((row: any) => ({
            id: row.id,
            demandId: row.demand_id,
            demandTitle: row.dependent?.title ?? "Desconhecida",
          }))
        );
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [demandId]);

  const invalidateDeps = () => {
    queryClient.invalidateQueries({ queryKey: ["batch-dependency-info"] });
    queryClient.invalidateQueries({ queryKey: ["demand-dependency-info"] });
    queryClient.invalidateQueries({ queryKey: ["demand-dependencies"] });
    queryClient.invalidateQueries({ queryKey: ["demands"] });
  };

  const markAsDelivered = async (targetDemandId: string, targetTitle: string) => {
    setBusy(true);
    try {
      // Look up the "Entregue" status id (system status)
      const { data: entregue, error: statusErr } = await supabase
        .from("demand_statuses")
        .select("id")
        .eq("name", "Entregue")
        .is("board_id", null)
        .maybeSingle();
      if (statusErr) throw statusErr;
      if (!entregue) throw new Error("Status 'Entregue' não encontrado");

      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("demands")
        .update({
          status_id: entregue.id,
          status_changed_by: user?.id ?? null,
          status_changed_at: nowIso,
          delivered_at: nowIso,
          last_started_at: null,
        })
        .eq("id", targetDemandId);
      if (error) throw error;

      // Close any open timer entries
      await supabase
        .from("demand_time_entries")
        .update({ ended_at: nowIso })
        .eq("demand_id", targetDemandId)
        .is("ended_at", null);

      toast.success(`"${targetTitle}" marcada como entregue`);
      invalidateDeps();
      onActionDone?.();
    } catch (err) {
      toast.error("Não foi possível marcar como entregue", { description: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const removeDependency = async (depId: string, label: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("demand_dependencies").delete().eq("id", depId);
      if (error) throw error;
      toast.success(`Dependência removida (${label})`);
      invalidateDeps();
      onActionDone?.();
    } catch (err) {
      toast.error("Não foi possível remover a dependência", { description: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return showEmptyHint ? (
      <DropdownMenuItem disabled>Carregando dependências…</DropdownMenuItem>
    ) : null;
  }
  if (blocking.length === 0 && dependents.length === 0) {
    return showEmptyHint ? (
      <DropdownMenuItem disabled>Sem dependências</DropdownMenuItem>
    ) : null;
  }

  const blockedByOpen = blocking.filter((d) => d.dependsOnStatusName !== "Entregue");
  const showDelivered = !isDelivered && dependents.length > 0;

  return (
    <>
      {!showEmptyHint && <DropdownMenuSeparator />}
      <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
        Dependências
      </DropdownMenuLabel>

      {/* This demand depends on others (outgoing) */}
      {blockedByOpen.map((dep) => (
        <DropdownMenuItem
          key={`mark-${dep.id}`}
          disabled={busy}
          onSelect={(e) => {
            e.preventDefault();
            void markAsDelivered(dep.dependsOnDemandId, dep.dependsOnTitle);
          }}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          <span className="truncate">Concluir “{dep.dependsOnTitle}”</span>
        </DropdownMenuItem>
      ))}
      {blocking.map((dep) => (
        <DropdownMenuItem
          key={`unlink-out-${dep.id}`}
          disabled={busy}
          onSelect={(e) => {
            e.preventDefault();
            void removeDependency(dep.id, `→ ${dep.dependsOnTitle}`);
          }}
        >
          <Link2Off className="h-4 w-4 mr-2 text-muted-foreground" />
          <span className="truncate">Remover vínculo com “{dep.dependsOnTitle}”</span>
        </DropdownMenuItem>
      ))}

      {/* Other demands depend on this one (incoming) */}
      {showDelivered && (
        <DropdownMenuItem
          disabled={busy}
          onSelect={(e) => {
            e.preventDefault();
            void markAsDelivered(demandId, "Esta demanda");
          }}
        >
          <CheckCircle2 className="h-4 w-4 mr-2" />
          <span className="truncate">
            Marcar como entregue (destrava {dependents.length})
          </span>
        </DropdownMenuItem>
      )}
      {dependents.map((dep) => (
        <DropdownMenuItem
          key={`unlink-in-${dep.id}`}
          disabled={busy}
          onSelect={(e) => {
            e.preventDefault();
            void removeDependency(dep.id, `← ${dep.demandTitle}`);
          }}
        >
          <Lock className="h-4 w-4 mr-2 text-muted-foreground" />
          <span className="truncate">Remover bloqueio de “{dep.demandTitle}”</span>
        </DropdownMenuItem>
      ))}
    </>
  );
}
