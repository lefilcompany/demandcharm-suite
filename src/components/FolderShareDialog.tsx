// Acesso ao projeto: integrantes da performance escolhida (contam no custo hora/homem)
// e compartilhamento externo somente leitura. Só o proprietário do projeto altera.
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, Lock, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useTeamPerformances } from "@/hooks/useTeamPositions";
import { usePerformanceStaff } from "@/components/CreateFolderDialog";
import type { FolderPermission } from "@/hooks/useDemandFolders";
import { toast } from "sonner";

interface FolderShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: string;
  folderName: string;
  teamId: string | null;
  sharedWith: { user_id: string; shared_at: string; permission: FolderPermission }[];
}

export function FolderShareDialog({ open, onOpenChange, folderId, folderName, teamId, sharedWith }: FolderShareDialogProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: members = [] } = useTeamMembers(teamId);
  const { data: performances = [] } = useTeamPerformances(teamId);
  const { data: project } = useQuery({
    queryKey: ["project-staff", folderId],
    enabled: open,
    queryFn: async () => {
      const [{ data: p, error }, { data: pm, error: e2 }] = await Promise.all([
        supabase.from("projects").select("created_by, performance_id").eq("id", folderId).maybeSingle(),
        supabase.from("project_members").select("user_id").eq("project_id", folderId),
      ]);
      if (error) throw error;
      if (e2) throw e2;
      return { createdBy: p?.created_by as string, performanceId: (p as any)?.performance_id as string | null, userIds: (pm ?? []).map((r) => r.user_id) };
    },
  });
  const isOwner = !!user && project?.createdBy === user.id;

  const [perf, setPerf] = useState("");
  const [staffSel, setStaffSel] = useState<Set<string>>(new Set());
  const [shareSel, setShareSel] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const { data: staff = [], isLoading: staffLoading } = usePerformanceStaff(teamId, perf);

  useEffect(() => {
    if (!open || !project) return;
    setPerf(project.performanceId ?? "");
    setStaffSel(new Set(project.userIds));
    setShareSel(new Set(sharedWith.map((s) => s.user_id)));
  }, [open, project, sharedWith]);

  const currentPerf = useMemo(() => performances.find((p) => p.id === perf), [performances, perf]);

  const externals = useMemo(
    () =>
      (members as any[])
        .filter((m) => m.member_kind !== "internal" && m.user_id !== user?.id)
        .sort((a, b) => (a.profile?.full_name ?? "").localeCompare(b.profile?.full_name ?? "")),
    [members, user?.id],
  );

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const n = new Set(set);
    n.has(id) ? n.delete(id) : n.add(id);
    setter(n);
  };

  const handleSave = async () => {
    if (perf && staffSel.size === 0) {
      toast.error("Marque ao menos um integrante da performance");
      return;
    }
    setSaving(true);
    try {
      if (perf) {
        // A performance é fixa por projeto; o RPC valida que os integrantes pertencem a ela.
        const { error } = await (supabase as any).rpc("set_project_staff", {
          _project_id: folderId, _performance_id: perf, _user_ids: [...staffSel],
        });
        if (error) throw error;
      }
      // Compartilhamento externo: sempre somente leitura.
      const current = new Set(sharedWith.map((s) => s.user_id));
      const externalIds = new Set(externals.map((m: any) => m.user_id));
      const toAdd = [...shareSel].filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !shareSel.has(id) && externalIds.has(id));
      const toDowngrade = sharedWith.filter((s) => shareSel.has(s.user_id) && s.permission !== "view").map((s) => s.user_id);
      if (toAdd.length) {
        const { error: e } = await supabase.from("project_shares").insert(toAdd.map((uid) => ({ project_id: folderId, user_id: uid, permission: "view" })) as any);
        if (e) throw e;
      }
      if (toRemove.length) {
        const { error: e } = await supabase.from("project_shares").delete().eq("project_id", folderId).in("user_id", toRemove);
        if (e) throw e;
      }
      if (toDowngrade.length) {
        const { error: e } = await supabase.from("project_shares").update({ permission: "view" } as any).eq("project_id", folderId).in("user_id", toDowngrade);
        if (e) throw e;
      }
      qc.invalidateQueries({ queryKey: ["demand-folders"] });
      qc.invalidateQueries({ queryKey: ["project-staff"] });
      qc.invalidateQueries({ queryKey: ["project-staff-all"] });
      toast.success("Acesso do projeto atualizado");
      onOpenChange(false);
    } catch (e: any) {
      const m = String(e?.message ?? "");
      toast.error(m.includes("MEMBER_NOT_IN_PERFORMANCE") ? "Algum integrante não faz parte da performance" : m.includes("FORBIDDEN") ? "Só o proprietário do projeto pode alterar o acesso" : "Erro ao salvar acesso");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Acesso ao projeto</DialogTitle>
          <DialogDescription className="truncate">{folderName}</DialogDescription>
        </DialogHeader>

        {project && !isOwner && (
          <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" /> Só o proprietário do projeto pode alterar integrantes e compartilhamento.
          </div>
        )}

        <section className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4" /> Performance e integrantes</h4>
          {/* A performance é fixa por projeto (definida na criação): aqui só se exibe; o que muda são os integrantes. */}
          {currentPerf ? (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: currentPerf.color }} />
              <span className="text-sm font-medium">{currentPerf.name}</span>
            </div>
          ) : (
            <p className="rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              Este projeto não tem performance definida; apenas o compartilhamento externo pode ser alterado.
            </p>
          )}
          {perf && (
            <ul className="max-h-44 overflow-y-auto rounded-lg border divide-y">
              {staffLoading && <li className="p-3 text-sm text-muted-foreground">Carregando...</li>}
              {!staffLoading && staff.length === 0 && <li className="p-3 text-sm text-muted-foreground">Essa performance não tem membros.</li>}
              {staff.map((m) => (
                <li key={m.userId}>
                  <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={staffSel.has(m.userId)} disabled={!isOwner} onCheckedChange={() => toggle(staffSel, setStaffSel, m.userId)} />
                    <span className="text-sm">{m.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-semibold"><Eye className="h-4 w-4" /> Compartilhamento externo</h4>
          <p className="text-xs text-muted-foreground">Pessoas externas da equipe veem o projeto somente em modo leitura.</p>
          <ul className="max-h-40 overflow-y-auto rounded-lg border divide-y">
            {externals.length === 0 && <li className="p-3 text-sm text-muted-foreground">Nenhum membro externo na equipe.</li>}
            {externals.map((m: any) => (
              <li key={m.user_id}>
                <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={shareSel.has(m.user_id)} disabled={!isOwner} onCheckedChange={() => toggle(shareSel, setShareSel, m.user_id)} />
                  <span className="text-sm flex-1">{m.profile?.full_name || "Sem nome"}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">Leitura</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          {isOwner && <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
