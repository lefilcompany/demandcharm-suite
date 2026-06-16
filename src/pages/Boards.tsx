import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LayoutGrid, Users, Settings2, Plus, Trash2, Search, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { useBoards, useDeleteBoard } from "@/hooks/useBoards";
import { useBoardMembers, useBoardRole } from "@/hooks/useBoardMembers";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useTeamRole } from "@/hooks/useTeamRole";
import { CreateBoardDialog } from "@/components/CreateBoardDialog";
import { SEOHead } from "@/components/SEOHead";

function BoardCard({ board }: { board: { id: string; name: string; description: string | null; monthly_demand_limit: number; team_id: string } }) {
  const navigate = useNavigate();
  const { data: members, isLoading: membersLoading } = useBoardMembers(board.id);
  const { data: role } = useBoardRole(board.id);
  const deleteBoard = useDeleteBoard();

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");

  const canDelete = role === "admin";
  const confirmText = board.name.toUpperCase();
  const isConfirmed = confirmInput.toUpperCase() === confirmText;

  const handleDelete = async () => {
    if (!isConfirmed) return;
    try {
      await deleteBoard.mutateAsync({ boardId: board.id, teamId: board.team_id });
      setShowDeleteDialog(false);
      setConfirmInput("");
    } catch {
      // handled by hook
    }
  };

  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    moderator: "Coordenador",
    executor: "Agente",
    requester: "Solicitante",
  };

  const roleColors: Record<string, string> = {
    admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    moderator: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    executor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    requester: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  return (
    <>
      <Card 
        className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 min-w-0 group relative"
        onClick={() => navigate(`/boards/${board.id}`)}
      >
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10 z-10"
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteDialog(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        <CardHeader className="pb-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <LayoutGrid className="h-5 w-5 text-primary shrink-0" />
              <CardTitle className="text-base font-semibold truncate">{board.name}</CardTitle>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {role && (
              <Badge className={`text-xs shrink-0 pointer-events-none ${roleColors[role] || ""}`}>
                {roleLabels[role] || role}
              </Badge>
            )}
          </div>
          {board.description && (
            <CardDescription className="line-clamp-2 text-sm">{board.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5 min-w-0">
              <Users className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {membersLoading ? (
                  <Skeleton className="h-4 w-8 inline-block" />
                ) : (
                  `${members?.length || 0} membros`
                )}
              </span>
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
              <Settings2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{board.monthly_demand_limit || "Ilimitado"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={(open) => {
        setShowDeleteDialog(open);
        if (!open) setConfirmInput("");
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir quadro "{board.name}"?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                Esta ação é irreversível. Todas as demandas, anexos e dados associados a este quadro serão permanentemente excluídos.
              </span>
              <span className="block font-medium text-foreground">
                Digite <span className="font-bold text-destructive">{confirmText}</span> para confirmar:
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Label htmlFor="confirm-delete" className="sr-only">Confirmação</Label>
            <Input
              id="confirm-delete"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={confirmText}
              autoComplete="off"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={!isConfirmed || deleteBoard.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBoard.isPending ? "Excluindo..." : "Excluir Quadro"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default function Boards() {
  const { t } = useTranslation();
  const { selectedTeamId } = useSelectedTeam();
  const { data: boards, isLoading } = useBoards(selectedTeamId);
  const { data: teamRole } = useTeamRole(selectedTeamId);
  const [boardSearch, setBoardSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  
  const canCreateBoard = teamRole === "owner";

  const filteredBoards = boards?.filter((board) => {
    if (!boardSearch.trim()) return true;
    const q = boardSearch.toLowerCase();
    return (
      board.name.toLowerCase().includes(q) ||
      (board.description || "").toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SEOHead title="Quadros" path="/boards" />
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <SEOHead title="Quadros" path="/boards" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Meus Quadros</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Gerencie os quadros da sua equipe
          </p>
        </div>
        <div className="flex items-center gap-2">
          {boards && boards.length > 2 && (
            <div className="shrink-0">
              {searchOpen ? (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchRef}
                    placeholder="Buscar quadro..."
                    value={boardSearch}
                    onChange={(e) => setBoardSearch(e.target.value)}
                    className="pl-9 h-9 pr-8 w-[180px] sm:w-[240px]"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setSearchOpen(false);
                        setBoardSearch("");
                      }
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => { setSearchOpen(false); setBoardSearch(""); }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSearchOpen(true); setTimeout(() => searchRef.current?.focus(), 50); }}
                >
                  <Search className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Buscar</span>
                </Button>
              )}
            </div>
          )}
          {canCreateBoard && (
            <CreateBoardDialog 
              trigger={
                <Button size="sm" className="w-auto">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Novo Quadro</span>
                </Button>
              }
            />
          )}
        </div>
      </div>

      {filteredBoards && filteredBoards.length > 0 ? (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBoards.map((board) => (
            <BoardCard key={board.id} board={board} />
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <LayoutGrid className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum quadro encontrado</h3>
          <p className="text-muted-foreground mb-4">
            Você ainda não tem acesso a nenhum quadro.
          </p>
          {canCreateBoard && (
            <CreateBoardDialog 
              trigger={
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeiro Quadro
                </Button>
              }
            />
          )}
        </Card>
      )}
    </div>
  );
}
