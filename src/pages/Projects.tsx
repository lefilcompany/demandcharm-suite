import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Plus, Search, Users, Pencil, Trash2, MoreVertical, Share2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
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
  const { data: projects = [], isLoading } = useDemandFolders(selectedTeamId, user?.id);
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

  const handleCreate = (name: string, color: string) => {
    if (!selectedTeamId || !user) return;
    createMutation.mutate({ name, color, team_id: selectedTeamId, created_by: user.id });
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
                memberMap={memberMap}
                ownerProfile={memberMap.get(project.created_by)}
                onOpen={() => navigate(`/projects/${project.id}`)}
                onEdit={() => setEditing(project)}
                onShare={() => setSharing(project)}
                onDelete={() => setDeleting(project)}
                canManage={canEdit}
                canDelete={canDelete}
                myAccess={myAccess}
              />
            );
          })}
        </div>
      )}

      <CreateFolderDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onConfirm={handleCreate}
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
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
  memberMap: Map<string, any>;
  ownerProfile: any;
  onOpen: () => void;
  onEdit: () => void;
  onShare: () => void;
  onDelete: () => void;
  canManage: boolean;
  canDelete?: boolean;
  myAccess: "owner" | "edit" | "view";
}

function ProjectCard({ project, memberMap, ownerProfile, onOpen, onEdit, onShare, onDelete, canManage, canDelete, myAccess }: ProjectCardProps) {
  const sharedUsers = (project.shared_with || []).map((s) => memberMap.get(s.user_id)).filter(Boolean);
  const accessUsers = [ownerProfile, ...sharedUsers].filter(Boolean);
  const visibleAvatars = accessUsers.slice(0, 4);
  const extraCount = Math.max(0, accessUsers.length - visibleAvatars.length);

  const createdDate = new Date(project.created_at).toLocaleDateString("pt-BR");

  return (
    <div
      onClick={onOpen}
      className="group cursor-pointer rounded-xl border bg-card p-5 shadow-sm hover:shadow-md hover:border-[#F28705]/40 transition-all"
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
            <p className="text-xs text-muted-foreground">Criado em {createdDate}</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onShare} disabled={!canManage}>
              <Share2 className="h-4 w-4 mr-2" /> Gerenciar acesso
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit} disabled={!canManage}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} disabled={!(canDelete ?? canManage)} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs flex-wrap">
        <Badge variant="secondary" className="font-medium">
          {project.item_count ?? 0} demanda{(project.item_count ?? 0) === 1 ? "" : "s"}
        </Badge>
        {myAccess === "owner" ? (
          <Badge className="font-medium bg-[#F28705] hover:bg-[#F28705] text-white border-transparent">
            Proprietário
          </Badge>
        ) : myAccess === "edit" ? (
          <Badge variant="outline" className="font-medium border-[#F28705]/40 text-[#F28705]">
            Edição
          </Badge>
        ) : (
          <Badge variant="outline" className="font-medium">
            Visualização
          </Badge>
        )}
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
