import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  useTeamPositions, useCreatePosition, useUpdatePosition, useDeletePosition,
  useTogglePerformanceMember, TeamPosition,
} from "@/hooks/useTeamPositions";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { CreatePositionDialog } from "@/components/CreatePositionDialog";
import { canJoinPerformance } from "@/lib/performances";

interface Props {
  teamId: string;
  canManage: boolean;
  isAdmin: boolean;
}

/** Performances: grupos de membros internos da equipe; uma pessoa pode estar em várias. */
export function TeamPositionsManager({ teamId, canManage }: Props) {
  const { data: performances, isLoading } = useTeamPositions(teamId);
  const { data: members } = useTeamMembers(teamId);
  const create = useCreatePosition();
  const update = useUpdatePosition();
  const remove = useDeletePosition();
  const toggle = useTogglePerformanceMember();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TeamPosition | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [q, setQ] = useState("");

  const open = performances?.find((p) => p.id === openId) ?? null;
  const internals = useMemo(
    () => (members ?? []).filter((m) => canJoinPerformance(m.member_kind))
      .sort((a, b) => a.profile.full_name.localeCompare(b.profile.full_name)),
    [members],
  );
  const inOpen = (m: (typeof internals)[number]) => !!open && m.performances.some((p) => p.id === open.id);
  const shown = internals
    .filter((m) => m.profile.full_name.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(inOpen(b)) - Number(inOpen(a)));
  const openCount = internals.filter(inOpen).length;

  const save = async (data: { name: string; description?: string; color: string; textColor: string }) => {
    try {
      if (editing) {
        await update.mutateAsync({ positionId: editing.id, teamId, ...data });
        toast.success("Performance atualizada");
      } else {
        await create.mutateAsync({ teamId, ...data });
        toast.success("Performance criada");
      }
      setDialogOpen(false);
      setEditing(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar performance");
    }
  };

  if (isLoading) {
    return (
      <Card><CardHeader><Skeleton className="h-6 w-40" /></CardHeader><CardContent><Skeleton className="h-16 w-full" /></CardContent></Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex min-w-0 items-center gap-2">
            <Users className="h-5 w-5 shrink-0" />
            Performances
          </CardTitle>
          {canManage && (performances?.length ?? 0) > 0 && (
            <Button onClick={() => { setEditing(null); setDialogOpen(true); }} variant="outline" size="sm" className="h-7 gap-1.5 px-2.5 text-xs">
              <Plus className="h-3 w-3" /> Criar performance
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!performances || performances.length === 0 ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border/70 px-3 py-2.5">
              <p className="text-sm text-muted-foreground">Nenhuma performance criada</p>
              {canManage && (
                <Button onClick={() => { setEditing(null); setDialogOpen(true); }} variant="outline" size="sm" className="h-7 shrink-0 gap-1.5 px-2.5 text-xs">
                  <Plus className="h-3 w-3" /> Criar performance
                </Button>
              )}
            </div>
          ) : (
            <ul className="divide-y rounded-lg border">
              {performances.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => { setOpenId(p.id); setQ(""); }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{p.name}</span>
                      {p.description && <span className="block truncate text-xs text-muted-foreground">{p.description}</span>}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {p.member_count ?? 0} {(p.member_count ?? 0) === 1 ? "pessoa" : "pessoas"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
          {open && (
            <>
              <SheetHeader className="space-y-1 text-left">
                <SheetTitle className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: open.color }} />
                  {open.name}
                </SheetTitle>
                <SheetDescription>
                  {open.description || "Grupo de membros internos da equipe."} · {openCount} {openCount === 1 ? "pessoa" : "pessoas"}
                </SheetDescription>
              </SheetHeader>

              {canManage && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => { setEditing(open); setDialogOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                    <Trash2 className="h-3.5 w-3.5" /> Excluir
                  </Button>
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar membro interno..." className="h-9 pl-8" />
              </div>

              <div className="-mx-2 flex-1 overflow-y-auto px-2">
                {shown.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nenhum membro interno encontrado</p>
                ) : (
                  <ul className="space-y-0.5">
                    {shown.map((m) => {
                      const checked = inOpen(m);
                      if (!canManage && !checked) return null;
                      return (
                        <li key={m.id}>
                          <label className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${canManage ? "cursor-pointer hover:bg-muted" : ""}`}>
                            {canManage && (
                              <Checkbox
                                checked={checked}
                                disabled={toggle.isPending}
                                onCheckedChange={(v) =>
                                  toggle.mutate(
                                    { performanceId: open.id, memberId: m.id, add: !!v, teamId },
                                    { onError: (e: any) => toast.error(e?.message || "Não foi possível alterar") },
                                  )
                                }
                              />
                            )}
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={m.profile.avatar_url ?? undefined} />
                              <AvatarFallback className="text-[10px]">{m.profile.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm">{m.profile.full_name}</span>
                              {m.performances.length > 1 && (
                                <span className="block truncate text-[11px] text-muted-foreground">
                                  Também em {m.performances.filter((p) => p.id !== open.id).map((p) => p.name).join(", ")}
                                </span>
                              )}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Somente membros internos podem fazer parte de performances.</p>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir performance?</AlertDialogTitle>
            <AlertDialogDescription>As pessoas continuam na equipe, só deixam de fazer parte de "{open?.name}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!open) return;
                try {
                  await remove.mutateAsync({ positionId: open.id, teamId });
                  toast.success("Performance excluída");
                  setOpenId(null);
                } catch {
                  toast.error("Só o dono da equipe pode excluir performances");
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CreatePositionDialog
        open={dialogOpen}
        onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}
        onSubmit={save}
        isLoading={create.isPending || update.isPending}
        editingPosition={editing}
      />
    </>
  );
}
