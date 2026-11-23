import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Power } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/** Estado do projeto como uma lâmpada de painel: aro cheio e halo quando os quadros estão rodando, aro oco quando estão parados. */
export function ProjectStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const active = (status ?? "active") === "active";
  return (
    <span
      role="status"
      aria-label={active ? "Projeto ativo" : "Projeto inativo"}
      title={active
        ? "Quadros funcionando e o projeto participa da divisão dos custos da equipe"
        : "Quadros somente leitura para todos e fora da divisão dos custos da equipe"}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] tabular-nums",
        active ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-muted/70 text-muted-foreground",
        className)}>
      <span
        aria-hidden
        className={cn("h-2 w-2 rounded-full", active
          ? "bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]"
          : "border-[1.5px] border-muted-foreground/55"
        )} />
      {active ? "Ativo" : "Inativo"}
    </span>
  );
}

/** Confirmation dialog that switches a project between active and inactive (server checks owner / project manager). */
export function useProjectStatusToggle(onDone?: () => void) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [target, setTarget] = useState<{ id: string; name: string; status: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const next = target?.status === "inactive" ? "active" : "inactive";
  const run = async () => {
    if (!target) return;
    setBusy(true);
    const { error } = await supabase.rpc("set_project_status" as any, { _project_id: target.id, _status: next });
    setBusy(false);
    if (error) {
      toast({ title: String(error.message).includes("FORBIDDEN") ? "Só o dono da equipe ou o gestor de projetos pode fazer isso." : "Não foi possível mudar a situação do projeto.", variant: "destructive" });
      return;
    }
    // O controle financeiro acompanha a situação do projeto.
    await supabase.from("projects").update({ finance_enabled: next === "active" }).eq("id", target.id);
    toast({ title: next === "active" ? "Projeto ativado" : "Projeto inativado" });
    setTarget(null);
    for (const k of ["demand-folders", "project-status", "board-frozen", "finance-table", "project-finance", "project-finance-config"]) qc.invalidateQueries({ queryKey: [k] });
    onDone?.();
  };
  const dialog = (
    <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{next === "inactive" ? `Inativar "${target?.name}"?` : `Ativar "${target?.name}"?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {next === "inactive"
              ? "Os quadros do projeto ficam somente leitura para todos: não será possível criar demandas, abrir solicitações, mudar etapas nem contar tempo. Timers em andamento serão parados, e o projeto deixa de dividir os custos da equipe a partir do próximo mês. Quadros que também estão em outro projeto ativo continuam funcionando."
              : "Os quadros voltam a funcionar normalmente e o projeto volta a dividir os custos da equipe."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); run(); }} disabled={busy}>{next === "inactive" ? "Inativar projeto" : "Ativar projeto"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { open: setTarget, dialog };
}

export function ProjectStatusButton({ project, onDone }: { project: { id: string; name: string; status?: string | null }; onDone?: () => void }) {
  const { open, dialog } = useProjectStatusToggle(onDone);
  const active = (project.status ?? "active") === "active";
  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => open({ id: project.id, name: project.name, status: project.status ?? "active" })}>
        <Power className="h-4 w-4" />{active ? "Inativar projeto" : "Ativar projeto"}
      </Button>
      {dialog}
    </>
  );
}
