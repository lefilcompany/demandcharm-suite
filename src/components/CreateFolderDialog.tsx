import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorPicker } from "@/components/ColorPicker";
import { supabase } from "@/integrations/supabase/client";
import { useTeamPerformances } from "@/hooks/useTeamPositions";

export interface ProjectStaff {
  performanceId: string;
  userIds: string[];
}

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string, color: string, staff?: ProjectStaff) => void;
  initialName?: string;
  initialColor?: string;
  isEditing?: boolean;
  /** Quando informado na criação, a performance e os integrantes passam a ser obrigatórios. */
  teamId?: string | null;
}

export function usePerformanceStaff(performanceId: string) {
  return useQuery({
    queryKey: ["performance-staff", performanceId],
    enabled: !!performanceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_performance_members")
        .select("team_member_id, team_members!inner(user_id)")
        .eq("performance_id", performanceId);
      if (error) throw error;
      const ids = (data ?? []).map((r: any) => r.team_members?.user_id).filter(Boolean) as string[];
      if (!ids.length) return [];
      const { data: profs, error: pe } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      if (pe) throw pe;
      return (profs ?? [])
        .map((p: any) => ({ userId: p.id as string, name: (p.full_name as string) || "Sem nome" }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  });
}

export function CreateFolderDialog({
  open,
  onOpenChange,
  onConfirm,
  initialName = "",
  initialColor = "#6B7280",
  isEditing = false,
  teamId,
}: CreateFolderDialogProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [performanceId, setPerformanceId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const needsStaff = !isEditing && !!teamId;
  const { data: performances = [], isLoading: perfLoading } = useTeamPerformances(needsStaff ? teamId : null);
  const { data: staff = [], isLoading: staffLoading } = usePerformanceStaff(needsStaff ? performanceId : "");

  useEffect(() => {
    if (open) {
      setName(initialName);
      setColor(initialColor);
      setPerformanceId("");
      setSelected(new Set());
    }
  }, [open, initialName, initialColor]);

  const canSubmit = !!name.trim() && (!needsStaff || (!!performanceId && selected.size > 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onConfirm(name.trim(), color, needsStaff ? { performanceId, userIds: [...selected] } : undefined);
    onOpenChange(false);
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar projeto" : "Novo projeto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="folder-name">Nome</Label>
            <Input
              id="folder-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Projeto Website"
              autoFocus
              maxLength={60}
            />
          </div>
          <ColorPicker value={color} onChange={setColor} label="Cor" />

          {needsStaff && (
            <>
              <div className="space-y-2">
                <Label>Performance que atua no projeto *</Label>
                <Select
                  value={performanceId}
                  onValueChange={(v) => {
                    setPerformanceId(v);
                    setSelected(new Set());
                  }}
                >
                  <SelectTrigger aria-label="Performance">
                    <SelectValue placeholder={perfLoading ? "Carregando..." : "Escolha a performance"} />
                  </SelectTrigger>
                  <SelectContent>
                    {performances.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                          {p.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!perfLoading && performances.length === 0 && (
                  <p className="text-xs text-destructive">
                    Nenhuma performance criada. Crie uma em Equipe → Performances antes de criar o projeto.
                  </p>
                )}
              </div>

              {performanceId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Integrantes do projeto *</Label>
                    <span className="text-xs text-muted-foreground">{selected.size} selecionado(s)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">O custo hora/homem de quem você marcar entra no projeto.</p>
                  <ul className="max-h-48 overflow-y-auto rounded-lg border divide-y">
                    {staffLoading && <li className="p-3 text-sm text-muted-foreground">Carregando...</li>}
                    {!staffLoading && staff.length === 0 && (
                      <li className="p-3 text-sm text-destructive">Essa performance não tem membros.</li>
                    )}
                    {staff.map((m) => (
                      <li key={m.userId}>
                        <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/50">
                          <Checkbox checked={selected.has(m.userId)} onCheckedChange={() => toggle(m.userId)} />
                          <span className="text-sm">{m.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isEditing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
