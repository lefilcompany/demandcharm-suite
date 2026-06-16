import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SectionShell } from "./SectionShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useTeamRole } from "@/hooks/useTeamRole";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Users, LogOut, Trash2, Loader2, Eye, EyeOff } from "lucide-react";

export function TeamSection() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentTeam, selectedTeamId, setSelectedTeamId, teams } = useSelectedTeam();
  const { data: myRole } = useTeamRole(selectedTeamId);
  const { data: teamMembers } = useTeamMembers(selectedTeamId);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [selectedNewAdmin, setSelectedNewAdmin] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  const isAdmin = myRole === "owner";
  const isOnly = teamMembers?.length === 1;
  const others = teamMembers?.filter((m) => m.user_id !== user?.id) || [];

  const switchAfterLeave = () => {
    const remaining = teams?.filter((t) => t.id !== selectedTeamId);
    if (remaining && remaining.length > 0) setSelectedTeamId(remaining[0].id);
    else { setSelectedTeamId(null); navigate("/welcome"); }
  };

  const transferAndLeave = async () => {
    if (!user?.id || !selectedTeamId || !selectedNewAdmin) return;
    setIsTransferring(true);
    try {
      const { error: e1 } = await supabase.from("team_members").update({ role: "admin" })
        .eq("team_id", selectedTeamId).eq("user_id", selectedNewAdmin);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("team_members").delete()
        .eq("team_id", selectedTeamId).eq("user_id", user.id);
      if (e2) throw e2;
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["team-role"] });
      switchAfterLeave();
      toast.success("Administração transferida e você saiu da equipe");
      setTransferOpen(false);
      setSelectedNewAdmin(null);
    } catch {
      toast.error("Erro ao transferir administração");
    } finally {
      setIsTransferring(false);
    }
  };

  const leave = useMutation({
    mutationFn: async (teamId: string) => {
      if (!user?.id) throw new Error("Não autenticado");
      const { error } = await supabase.from("team_members").delete().eq("team_id", teamId).eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      switchAfterLeave();
      toast.success("Você saiu da equipe");
    },
    onError: () => toast.error("Erro ao sair da equipe"),
  });

  const handleDeleteTeam = async () => {
    if (!user?.email || !deletePassword || !selectedTeamId) return;
    setIsDeleting(true);
    try {
      const { error: ae } = await supabase.auth.signInWithPassword({ email: user.email, password: deletePassword });
      if (ae) { toast.error("Senha incorreta"); return; }
      const { error: de } = await supabase.from("teams").delete().eq("id", selectedTeamId);
      if (de) throw de;
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      switchAfterLeave();
      toast.success("Equipe excluída");
      setDeleteOpen(false);
      setDeletePassword("");
    } catch {
      toast.error("Erro ao excluir equipe");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!currentTeam) {
    return (
      <SectionShell icon={Users} title="Equipe" description="Gerencie sua participação">
        <p className="text-sm text-muted-foreground">Você não está em nenhuma equipe ativa.</p>
      </SectionShell>
    );
  }

  return (
    <SectionShell icon={Users} title="Equipe" description={`Gerencie sua participação em "${currentTeam.name}"`}>
      {(!isAdmin || (isAdmin && !isOnly)) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border bg-muted/30">
          <div className="flex items-center gap-3">
            <LogOut className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">Sair da equipe</p>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? "Transfira a administração antes de sair" : "Você perderá acesso aos quadros e demandas"}
              </p>
            </div>
          </div>
          {isAdmin ? (
            <Dialog open={transferOpen} onOpenChange={(o) => { setTransferOpen(o); if (!o) setSelectedNewAdmin(null); }}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={isTransferring}>
                  <LogOut className="mr-2 h-4 w-4" />Sair
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Transferir administração</DialogTitle>
                  <DialogDescription>Selecione um membro para assumir a administração.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-2">
                  <Label>Novo administrador</Label>
                  <Select value={selectedNewAdmin || ""} onValueChange={setSelectedNewAdmin}>
                    <SelectTrigger><SelectValue placeholder="Selecione um membro" /></SelectTrigger>
                    <SelectContent>
                      {others.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>{m.profile.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
                  <Button onClick={transferAndLeave} disabled={!selectedNewAdmin || isTransferring}>
                    {isTransferring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Transferir e sair
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={leave.isPending}>
                  {leave.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}Sair
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sair da equipe?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja sair de "{currentTeam.name}"? Você perderá acesso a todos os quadros e dados.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => leave.mutate(currentTeam.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Sair da equipe
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg border border-destructive/20 bg-destructive/5">
          <div className="flex items-center gap-3">
            <Trash2 className="h-4 w-4 text-destructive" />
            <div>
              <p className="font-medium text-sm">Excluir equipe</p>
              <p className="text-xs text-muted-foreground">Ação irreversível — apaga todos os dados</p>
            </div>
          </div>
          <Dialog open={deleteOpen} onOpenChange={(o) => { setDeleteOpen(o); if (!o) { setDeletePassword(""); setShowDeletePassword(false); } }}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm"><Trash2 className="mr-2 h-4 w-4" />Excluir</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Excluir "{currentTeam.name}"?</DialogTitle>
                <DialogDescription>Todos os dados, quadros e membros serão excluídos permanentemente.</DialogDescription>
              </DialogHeader>
              <div className="space-y-2 py-4">
                <Label>Confirme sua senha</Label>
                <div className="relative">
                  <Input
                    type={showDeletePassword ? "text" : "password"}
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Digite sua senha"
                    className="pr-10"
                  />
                  <Button type="button" variant="ghost" size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowDeletePassword(!showDeletePassword)}>
                    {showDeletePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
                <Button variant="destructive" onClick={handleDeleteTeam} disabled={!deletePassword || isDeleting}>
                  {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Excluir equipe
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </SectionShell>
  );
}
