import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Plus, Search, Users, Pencil, Trash2, MoreVertical, Share2, AlertTriangle, RefreshCw, LayoutGrid, Landmark } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useAuth } from "@/lib/auth";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import {
  useDemandFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  type DemandFolder,
} from "@/hooks/useDemandFolders";
import { useBoards } from "@/hooks/useBoards";
import { useFinanceAccess } from "@/hooks/useFinance";
import { useQuery } from "@tanstack/react-query";
import { Power } from "lucide-react";
import { ProjectStatusBadge, useProjectStatusToggle } from "@/components/projects/ProjectStatusControl";
import { supabase } from "@/integrations/supabase/client";
import { CreateFolderDialog, type ProjectStaff } from "@/components/CreateFolderDialog";
import { FolderShareDialog } from "@/components/FolderShareDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Projects() {
  const { selectedTeamId } = useSelectedTeam();
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    data: projects = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useDemandFolders(selectedTeamId, user?.id);
  // "Gestão financeira" no menu do projeto: só com permissão no perfil de acesso ou sendo dono da equipe.
  const financeAccess = useFinanceAccess(selectedTeamId);
  const { data: projectBoards = [] } = useBoards(selectedTeamId);
  const boardNameById = new Map(projectBoards.map((b) => [b.id, b.name]));
  const { data: boardLinks = [] } = useQuery({
    queryKey: ["project-board-links", selectedTeamId, user?.id],
    enabled: !!selectedTeamId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_boards" as any)
        .select("project_id, board_id, valid_to")
        .eq("team_id", selectedTeamId!);
      if (error) throw error;
      const today = new Date().toISOString().substring(0, 10);
      return ((data as any[]) || []).filter((l) => !l.valid_to || String(l.valid_to).substring(0, 10) >= today);
    },
  });
  const { data: demandBoardLinks = [] } = useQuery({
    queryKey: ["project-demand-board-links", selectedTeamId, user?.id],
    enabled: !!selectedTeamId && !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_demands" as any)
        .select("project_id, demands!inner(board_id, team_id)")
        .eq("demands.team_id", selectedTeamId!);
      if (error) throw error;
      return ((data as any[]) || []).map((r) => ({ project_id: r.project_id, board_id: r.demands?.board_id }));
    },
  });

  const boardsByProject = useMemo(() => {
    const m = new Map<string, string[]>();
    [...(boardLinks as any[]), ...(demandBoardLinks as any[])].forEach((l) => {
      const name = boardNameById.get(l.board_id);
      if (!name) return;
      const arr = m.get(l.project_id) || [];
      if (!arr.includes(name)) arr.push(name);
      m.set(l.project_id, arr);
    });
    return m;
  }, [boardLinks, demandBoardLinks, projectBoards]);

  const { data: teamMembers = [] } = useTeamMembers(selectedTeamId);
  const createMutation = useCreateFolder();
  const updateMutation = useUpdateFolder();
  const deleteMutation = useDeleteFolder();

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DemandFolder | null>(null);
  const [sharing, setSharing] = useState<DemandFolder | null>(null);
  const [deleting, setDeleting] = useState<DemandFolder | null>(null);

  const memberMap = useMemo(() => {
    const m = new Map<string, any>();
    (teamMembers as any[]).forEach((tm) => m.set(tm.user_id, tm.profile));
    return m;
  }, [teamMembers]);

  const accessible = useMemo(() => {
    if (!user) return [];
    return projects.filter(
      (p) => p.is_owner === true || (p.shared_with || []).some((s) => s.user_id === user.id),
    );
  }, [projects, user]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return accessible;
    return accessible.filter((p) => p.name.toLowerCase().includes(q));
  }, [accessible, search]);

  const handleCreate = (name: string, color: string, staff?: ProjectStaff) => {
    if (!selectedTeamId || !user) return;
    createMutation.mutate({ name, color, team_id: selectedTeamId, created_by: user.id, staff });
  };

  const handleUpdate = (name: string, color: string) => {
    if (!editing) return;
    updateMutation.mutate({ id: editing.id, name, color });
    setEditing(null);
  };

  return (
    <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projetos</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize demandas da equipe em projetos compartilháveis
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#F28705] hover:bg-[#D97706] text-white"
        >
          <Plus className="h-4 w-4 mr-2" /> Novo projeto
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar projetos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-10"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Carregando...</div>
      ) : isError ? (
        // A falha de rede nunca pode parecer "nenhum projeto": o usuário precisa
        // saber que a lista não foi carregada e poder tentar de novo.
        <div
          role="alert"
          className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-destructive/40 rounded-2xl bg-destructive/5"
        >
          <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <h3 className="text-base font-semibold mb-1">Não foi possível carregar os projetos</h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            Seus projetos continuam salvos. Verifique a conexão e tente novamente.
          </p>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Tentar novamente
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-2xl bg-muted/20">
          <div className="h-14 w-14 rounded-2xl bg-[#F28705]/10 flex items-center justify-center mb-4">
            <Briefcase className="h-7 w-7 text-[#F28705]" />
          </div>
          <h3 className="text-base font-semibold mb-1">
            {search ? "Nenhum projeto encontrado" : "Nenhum projeto ainda"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            {search
              ? "Tente buscar com outro termo."
              : "Crie projetos para agrupar demandas relacionadas e compartilhar com a equipe."}
          </p>
          {!search && (
            <Button
              onClick={() => setCreateOpen(true)}
              className="bg-[#F28705] hover:bg-[#D97706] text-white"
            >
              <Plus className="h-4 w-4 mr-2" /> Criar primeiro projeto
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const myShare = project.shared_with?.find((s) => s.user_id === user?.id);
            const canEdit = project.is_owner === true || myShare?.permission === "edit";
            const canDelete = project.is_owner === true;
            const myAccess: "owner" | "edit" | "view" = project.is_owner
              ? "owner"
              : myShare?.permission === "edit"
              ? "edit"
              : "view";
            return (
              <ProjectCard
                key={project.id}
                project={project}
                boardNames={(() => {
                  const names = [...(boardsByProject.get(project.id) || [])];
                  const legacy = project.board_id ? boardNameById.get(project.board_id) : undefined;
                  if (legacy && !names.includes(legacy)) names.unshift(legacy);
                  return names;
                })()}
                memberMap={memberMap}
                ownerProfile={memberMap.get(project.created_by)}
                onOpen={() => navigate(`/app/projects/${project.id}`)}
                onEdit={() => setEditing(project)}
                onShare={() => setSharing(project)}
                onDelete={() => setDeleting(project)}
                canManage={canEdit}
                canDelete={canDelete}
                myAccess={myAccess}
                canSeeFinance={financeAccess.hasModule}
                onOpenFinance={() => navigate(`/app/projects/${project.id}/finance`)}
              />

            );
          })}
        </div>
      )}

      <CreateFolderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onConfirm={handleCreate}
        teamId={selectedTeamId}
      />

      {editing && (
        <CreateFolderDialog
          open={true}
          onOpenChange={(o) => !o && setEditing(null)}
          onConfirm={handleUpdate}
          initialName={editing.name}
          initialColor={editing.color}
          isEditing
        />
      )}

      {sharing && selectedTeamId && (
        <FolderShareDialog
          open={true}
          onOpenChange={(o) => !o && setSharing(null)}
          folderId={sharing.id}
          folderName={sharing.name}
          teamId={selectedTeamId}
          sharedWith={sharing.shared_with || []}
        />
      )}

      {deleting && (
        <AlertDialog open onOpenChange={(o) => !o && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir projeto</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o projeto "{deleting.name}"? As demandas vinculadas não serão excluídas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  deleteMutation.mutate(deleting.id);
                  setDeleting(null);
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

interface ProjectCardProps {
  project: DemandFolder;
  boardNames: string[];

  memberMap: Map<string, any>;
  ownerProfile: any;
  onOpen: () => void;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
  canManage: boolean;
  canDelete?: boolean;
  myAccess: "owner" | "edit" | "view";
  canSeeFinance: boolean;
  onOpenFinance: () => void;
}

function ProjectCard({ project, boardNames, memberMap, ownerProfile, onOpen, onEdit, onShare, onDelete, canManage, canDelete, myAccess, canSeeFinance, onOpenFinance }: ProjectCardProps) {
  const sharedUsers = (project.shared_with || []).map((s) => memberMap.get(s.user_id)).filter(Boolean);
  const accessUsers = [ownerProfile, ...sharedUsers].filter(Boolean);
  const visibleAvatars = accessUsers.slice(0, 4);
  const extraCount = Math.max(0, accessUsers.length - visibleAvatars.length);

  const createdDate = new Date(project.created_at).toLocaleDateString("pt-BR");
  const statusToggle = useProjectStatusToggle();

  return (
    <div
      onClick={onOpen}
      className={`group cursor-pointer rounded-xl border bg-card p-5 shadow-sm hover:shadow-md hover:border-[#F28705]/40 transition-all ${(project.status ?? "active") === "inactive" ? "opacity-70" : ""}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${project.color}1A` }}
          >
            <Briefcase className="h-5 w-5" style={{ color: project.color }} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground truncate">{project.name}</h3>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><ProjectStatusBadge status={project.status} />Criado em {createdDate}</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {canSeeFinance && (
              <DropdownMenuItem onClick={onOpenFinance}>
                <Landmark className="h-4 w-4 mr-2" /> Gestão financeira
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onShare} disabled={!canManage}>
              <Share2 className="h-4 w-4 mr-2" /> Gerenciar acesso
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit} disabled={!canManage}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => statusToggle.open({ id: project.id, name: project.name, status: project.status ?? "active" })} disabled={!canManage}>
              <Power className="h-4 w-4 mr-2" /> {(project.status ?? "active") === "active" ? "Inativar projeto" : "Ativar projeto"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} disabled={!(canDelete ?? canManage)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span onClick={(e) => e.stopPropagation()}>{statusToggle.dialog}</span>
      </div>

      <div className="mt-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 text-foreground">
            <span className="text-base font-semibold tabular-nums leading-none">{project.item_count ?? 0}</span>
            <span className="text-muted-foreground">demanda{(project.item_count ?? 0) === 1 ? "" : "s"}</span>
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              myAccess === "owner"
                ? "bg-primary/10 text-primary"
                : myAccess === "edit"
                ? "bg-muted text-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {myAccess === "owner" ? "Proprietário" : myAccess === "edit" ? "Edição" : "Visualização"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0" title={boardNames.join(", ")}>
          <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
          {boardNames.length === 0 ? (
            <span className="italic">Sem quadro</span>
          ) : (
            <span className="truncate">
              <span className="text-foreground">{boardNames[0]}</span>
              {boardNames.length > 1 && <span> +{boardNames.length - 1}</span>}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {visibleAvatars.map((p, i) => (
              <Avatar key={i} className="h-7 w-7 ring-2 ring-background">
                <AvatarImage src={p?.avatar_url || ""} />
                <AvatarFallback className="text-[10px]">
                  {(p?.full_name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {extraCount > 0 && (
              <div className="h-7 w-7 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-[10px] font-medium">
                +{extraCount}
              </div>
            )}
            {accessUsers.length === 0 && (
              <div className="h-7 w-7 rounded-full bg-muted ring-2 ring-background flex items-center justify-center">
                <Users className="h-3 w-3 text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
