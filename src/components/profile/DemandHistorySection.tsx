import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Checkbox } from "@/components/ui/checkbox";
import { History, Search, Lock, Unlock, Calendar, Loader2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props {
  userId: string;
  isPublic: boolean;
  embedded?: boolean;
}

type Period = "all" | "today" | "week" | "month";
type Stage = "all" | "todo" | "doing" | "delivered" | "late";

function getStage(d: any): Exclude<Stage, "all"> {
  const statusName: string = d?.demand_statuses?.name || "";
  if (d?.delivered_at) {
    if (d?.due_date) {
      const delivered = new Date(d.delivered_at).getTime();
      const due = new Date(String(d.due_date).substring(0, 10)).getTime();
      if (delivered > due) return "late";
    }
    return "delivered";
  }
  if (statusName === "A Iniciar") return "todo";
  return "doing";
}

const STAGE_META: Record<Exclude<Stage, "all">, { label: string; cls: string }> = {
  todo: { label: "A iniciar", cls: "border-muted-foreground/40 text-muted-foreground" },
  doing: { label: "Em andamento", cls: "border-blue-500/50 text-blue-500" },
  delivered: { label: "Entregue", cls: "border-emerald-500/60 text-emerald-500" },
  late: { label: "Entregue com atraso", cls: "border-amber-500/60 text-amber-500" },
};

function startOf(period: Period): Date | null {
  const now = new Date();
  if (period === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (period === "week") {
    const d = new Date(now);
    const day = d.getDay();
    const diff = (day + 6) % 7; // monday
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  return null;
}

export function DemandHistorySection({ userId, isPublic, embedded = false }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isOwn = user?.id === userId;
  const canView = isOwn || isPublic;

  const [period, setPeriod] = useState<Period>("all");
  const [stage, setStage] = useState<Stage>("all");
  const [client, setClient] = useState<string>("all");
  const [type, setType] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; boardId?: string | null; title: string } | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState<boolean>(false);

  const SKIP_KEY = "soma:demandHistory:skipNavConfirm";
  const skipConfirm = typeof window !== "undefined" && localStorage.getItem(SKIP_KEY) === "1";

  const goToDemand = (_boardId: string | null | undefined, demandId: string) => {
    navigate(`/demands/${demandId}`);
  };

  const handleOpenDemand = (d: any) => {
    if (skipConfirm) {
      goToDemand(d.boards?.id || d.board_id, d.id);
      return;
    }
    setConfirmTarget({ id: d.id, boardId: d.boards?.id || d.board_id, title: d.title });
  };

  const confirmNavigation = () => {
    if (!confirmTarget) return;
    if (dontAskAgain && typeof window !== "undefined") {
      localStorage.setItem(SKIP_KEY, "1");
    }
    goToDemand(confirmTarget.boardId, confirmTarget.id);
    setConfirmTarget(null);
    setDontAskAgain(false);
  };

  const { data: demands, isLoading } = useQuery({
    queryKey: ["demand-history", userId],
    queryFn: async () => {
      // Get demands where user is creator or assignee (all statuses)
      const [createdRes, assignedRes] = await Promise.all([
        supabase
          .from("demands")
          .select(
            `id, title, delivered_at, updated_at, created_at, due_date, board_id,
             status_id, service_id, created_by,
             demand_statuses(id, name, color),
             services(id, name),
             boards(id, name),
             assigned_profile:profiles!demands_assigned_to_fkey(id, full_name, avatar_url)`
          )
          .eq("created_by", userId)
          .eq("archived", false),
        supabase
          .from("demands")
          .select(
            `id, title, delivered_at, updated_at, created_at, due_date, board_id,
             status_id, service_id, created_by,
             demand_statuses(id, name, color),
             services(id, name),
             boards(id, name),
             assigned_profile:profiles!demands_assigned_to_fkey(id, full_name, avatar_url),
             demand_assignees!inner(user_id)`
          )
          .eq("demand_assignees.user_id", userId)
          .eq("archived", false),
      ]);

      if (createdRes.error) throw createdRes.error;
      if (assignedRes.error) throw assignedRes.error;

      const map = new Map<string, any>();
      [...(createdRes.data || []), ...(assignedRes.data || [])].forEach((d: any) => {
        map.set(d.id, d);
      });

      const arr = Array.from(map.values());
      arr.sort((a, b) => {
        const da = new Date(a.delivered_at || a.updated_at || a.created_at).getTime();
        const db = new Date(b.delivered_at || b.updated_at || b.created_at).getTime();
        return db - da;
      });
      return arr;
    },
    enabled: !!userId && canView,
    staleTime: 30000,
  });

  const togglePrivacy = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_demand_history_public: next } as any)
        .eq("id", userId);
      if (error) throw error;
    },
    onMutate: () => setSavingPrivacy(true),
    onSettled: () => setSavingPrivacy(false),
    onSuccess: (_d, next) => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile", userId] });
      toast.success(next ? "Histórico público" : "Histórico privado");
    },
    onError: () => toast.error("Erro ao alterar visibilidade"),
  });

  const clientOptions = useMemo(() => {
    const set = new Map<string, string>();
    (demands || []).forEach((d: any) => {
      if (d.boards?.id) set.set(d.boards.id, d.boards.name);
    });
    return Array.from(set.entries());
  }, [demands]);

  const typeOptions = useMemo(() => {
    const set = new Map<string, string>();
    (demands || []).forEach((d: any) => {
      if (d.services?.id) set.set(d.services.id, d.services.name);
    });
    return Array.from(set.entries());
  }, [demands]);

  const statusOptions = useMemo(() => {
    const set = new Map<string, { name: string; color: string }>();
    (demands || []).forEach((d: any) => {
      if (d.demand_statuses?.id)
        set.set(d.demand_statuses.id, {
          name: d.demand_statuses.name,
          color: d.demand_statuses.color,
        });
    });
    return Array.from(set.entries());
  }, [demands]);

  const filtered = useMemo(() => {
    const start = startOf(period);
    const q = search.trim().toLowerCase();
    return (demands || []).filter((d: any) => {
      const ref = new Date(d.delivered_at || d.updated_at || d.created_at);
      if (start && ref < start) return false;
      if (client !== "all" && d.boards?.id !== client) return false;
      if (type !== "all" && d.services?.id !== type) return false;
      if (statusFilter !== "all" && d.demand_statuses?.id !== statusFilter)
        return false;
      if (stage !== "all" && getStage(d) !== stage) return false;
      if (q) {
        const hay = [
          d.title,
          d.boards?.name,
          d.services?.name,
          d.demand_statuses?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [demands, period, client, type, statusFilter, stage, search]);

  // Reset to page 1 when filters / page size / underlying data change
  useEffect(() => {
    setPage(1);
  }, [period, client, type, statusFilter, stage, search, pageSize, demands?.length]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  const Wrapper: any = embedded ? "div" : Card;
  const ContentWrapper: any = embedded ? "div" : CardContent;

  return (
    <Wrapper>
      {!embedded && (<><CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-primary" />
              Histórico de demandas
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Acompanhe suas demandas a iniciar, em andamento e entregues. Filtre por etapa, período, cliente ou tipo.
            </p>
          </div>
          {isOwn && (
            <div className="flex items-center gap-2 shrink-0">
              {isPublic ? (
                <Unlock className="h-4 w-4 text-success" />
              ) : (
                <Lock className="h-4 w-4 text-muted-foreground" />
              )}
              <Label
                htmlFor="history-privacy"
                className="text-sm cursor-pointer select-none"
              >
                {isPublic ? "Histórico Público" : "Histórico Privado"}
              </Label>
              <Switch
                id="history-privacy"
                checked={isPublic}
                disabled={savingPrivacy}
                onCheckedChange={(v) => togglePrivacy.mutate(v)}
              />
            </div>
          )}
        </div>
      </CardHeader></>)}
      <ContentWrapper className={embedded ? "p-4 space-y-3" : "space-y-4"}>
        {!canView ? (
          <div className="py-12 text-center text-muted-foreground">
            <Lock className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>
              Este histórico está privado. Apenas o usuário pode visualizar suas
              demandas concluídas.
            </p>
          </div>
        ) : (
          <>
            {/* Filter toolbar */}
            {(() => {
              const activeCount =
                (period !== "all" ? 1 : 0) +
                (stage !== "all" ? 1 : 0) +
                (client !== "all" ? 1 : 0) +
                (type !== "all" ? 1 : 0) +
                (statusFilter !== "all" ? 1 : 0) +
                (search.trim() ? 1 : 0);
              const clearAll = () => {
                setPeriod("all");
                setStage("all");
                setClient("all");
                setType("all");
                setStatusFilter("all");
                setSearch("");
              };
              const stageCounts = (demands || []).reduce(
                (acc: Record<string, number>, d: any) => {
                  const s = getStage(d);
                  acc[s] = (acc[s] || 0) + 1;
                  return acc;
                },
                {} as Record<string, number>,
              );
              return (
                <div className="rounded-xl border bg-muted/30 p-3 space-y-3">
                  {/* Top row: search + clear */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 min-w-0">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar por título, cliente, tipo ou status..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 bg-background border-border/60 focus-visible:ring-primary/40"
                      />
                    </div>
                    {activeCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAll}
                        className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground gap-1.5 shrink-0"
                      >
                        <span className="inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
                          {activeCount}
                        </span>
                        Limpar
                      </Button>
                    )}
                  </div>

                  {/* Period segmented control */}
                  <div className="inline-flex items-center bg-background border border-border/60 rounded-full p-0.5 gap-0.5 max-w-full overflow-x-auto">
                    {(["all", "today", "week", "month"] as Period[]).map((p) => {
                      const active = period === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPeriod(p)}
                          className={`h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          }`}
                        >
                          {p === "all"
                            ? "Todos"
                            : p === "today"
                            ? "Hoje"
                            : p === "week"
                            ? "Esta semana"
                            : "Este mês"}
                        </button>
                      );
                    })}
                  </div>

                  {/* Stage pills */}
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { id: "all", label: "Todas as etapas", cls: "" },
                        { id: "todo", label: STAGE_META.todo.label, cls: STAGE_META.todo.cls },
                        { id: "doing", label: STAGE_META.doing.label, cls: STAGE_META.doing.cls },
                        { id: "delivered", label: STAGE_META.delivered.label, cls: STAGE_META.delivered.cls },
                        { id: "late", label: STAGE_META.late.label, cls: STAGE_META.late.cls },
                      ] as { id: Stage; label: string; cls: string }[]
                    ).map((s) => {
                      const active = stage === s.id;
                      const count = s.id === "all"
                        ? (demands || []).length
                        : stageCounts[s.id] || 0;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setStage(s.id)}
                          className={`h-7 px-2.5 rounded-full text-xs font-medium border inline-flex items-center gap-1.5 transition-colors ${
                            active
                              ? "bg-primary text-primary-foreground border-primary shadow-sm"
                              : `bg-background hover:bg-muted ${s.cls || "border-border/60 text-muted-foreground"}`
                          }`}
                        >
                          {s.label}
                          <span
                            className={`text-[10px] px-1.5 h-4 rounded-full inline-flex items-center ${
                              active ? "bg-primary-foreground/20" : "bg-muted"
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selects */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Select value={client} onValueChange={setClient}>
                      <SelectTrigger
                        className={`h-9 rounded-lg bg-background ${
                          client !== "all" ? "border-primary/60 text-foreground" : "border-border/60"
                        }`}
                      >
                        <SelectValue placeholder="Cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os clientes</SelectItem>
                        {clientOptions.map(([id, name]) => (
                          <SelectItem key={id} value={id}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger
                        className={`h-9 rounded-lg bg-background ${
                          type !== "all" ? "border-primary/60 text-foreground" : "border-border/60"
                        }`}
                      >
                        <SelectValue placeholder="Serviço" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os serviços</SelectItem>
                        {typeOptions.map(([id, name]) => (
                          <SelectItem key={id} value={id}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger
                        className={`h-9 rounded-lg bg-background ${
                          statusFilter !== "all" ? "border-primary/60 text-foreground" : "border-border/60"
                        }`}
                      >
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os status</SelectItem>
                        {statusOptions.map(([id, s]) => (
                          <SelectItem key={id} value={id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })()}

            {/* List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !demands || demands.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                Nenhuma demanda concluída encontrada.
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground text-sm">
                Nenhuma demanda concluída encontrada para os filtros selecionados.
              </div>
            ) : (
              <>
                {/* Pagination header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 mb-3 border-b">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {(safePage - 1) * pageSize + 1}–
                      {Math.min(safePage * pageSize, filtered.length)} de {filtered.length}
                    </span>
                    <span className="hidden sm:inline">•</span>
                    <span className="flex items-center gap-1.5">
                      Por página:
                      <Select
                        value={String(pageSize)}
                        onValueChange={(v) => setPageSize(Number(v))}
                      >
                        <SelectTrigger className="h-7 w-[68px] rounded-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[5, 10, 20, 50, 100].map((n) => (
                            <SelectItem key={n} value={String(n)}>
                              {n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-full"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Anterior
                    </Button>
                    <span className="text-xs text-muted-foreground px-2">
                      {safePage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-full"
                      disabled={safePage >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {paged.map((d: any) => {
                    const date = d.delivered_at || d.updated_at || d.created_at;
                    return (
                      <button
                        key={d.id}
                        onClick={() => handleOpenDemand(d)}
                        className="w-full text-left p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium truncate">{d.title}</p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mt-1">
                              {d.boards?.name && <span>{d.boards.name}</span>}
                              {d.services?.name && (
                                <>
                                  <span>•</span>
                                  <span>{d.services.name}</span>
                                </>
                              )}
                              {d.assigned_profile?.full_name && (
                                <>
                                  <span>•</span>
                                  <span>Resp.: {d.assigned_profile.full_name}</span>
                                </>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(date), "dd/MM/yyyy", { locale: ptBR })}
                              </span>
                              {d.due_date && (
                                <span>
                                  Prazo:{" "}
                                  {format(new Date(d.due_date), "dd/MM/yyyy", {
                                    locale: ptBR,
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {(() => {
                              const s = getStage(d);
                              return (
                                <Badge variant="outline" className={STAGE_META[s].cls}>
                                  {STAGE_META[s].label}
                                </Badge>
                              );
                            })()}
                            {d.demand_statuses?.name && (
                              <span
                                className="text-[10px] text-muted-foreground"
                                style={{ color: d.demand_statuses.color }}
                              >
                                {d.demand_statuses.name}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

              </>
            )}
          </>
        )}
      </ContentWrapper>

      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(o) => {
          if (!o) {
            setConfirmTarget(null);
            setDontAskAgain(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-primary" />
              Abrir demanda
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você será direcionado para a demanda{" "}
              <span className="font-medium text-foreground">
                "{confirmTarget?.title}"
              </span>{" "}
              e o quadro correspondente. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={dontAskAgain}
              onCheckedChange={(v) => setDontAskAgain(Boolean(v))}
            />
            Não perguntar novamente
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmNavigation}>
              Ir para demanda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Wrapper>
  );
}
