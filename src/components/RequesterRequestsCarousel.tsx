import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History, FileText, Tag, Layout, CalendarDays, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  approved: { label: "Aprovada", className: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" },
  returned: { label: "Devolvida", className: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30" },
  rejected: { label: "Rejeitada", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" },
};

export function RequesterRequestsCarousel() {
  const { user } = useAuth();
  const { selectedTeamId } = useSelectedTeam();
  const navigate = useNavigate();

  const { data: requests, isLoading } = useQuery({
    queryKey: ["requester-requests-carousel", user?.id, selectedTeamId],
    queryFn: async () => {
      if (!user || !selectedTeamId) return [];

      const { data, error } = await supabase
        .from("demand_requests")
        .select(`
          id, title, status, priority, created_at, responded_at,
          service:services(name),
          board:boards(name)
        `)
        .eq("created_by", user.id)
        .eq("team_id", selectedTeamId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      if (!data || data.length === 0) return [];

      // For approved requests, find matching demands to get current status
      const approvedRequests = data.filter((r: any) => r.status === "approved");
      let demandStatusMap: Record<string, { name: string; color: string }> = {};

      if (approvedRequests.length > 0) {
        const titles = approvedRequests.map((r: any) => r.title);
        const { data: demands } = await supabase
          .from("demands")
          .select("title, demand_statuses(name, color)")
          .eq("team_id", selectedTeamId)
          .in("title", titles);

        if (demands) {
          demands.forEach((d: any) => {
            if (d.demand_statuses) {
              demandStatusMap[d.title] = {
                name: d.demand_statuses.name,
                color: d.demand_statuses.color || "#6B7280",
              };
            }
          });
        }
      }

      return data.map((r: any) => ({
        ...r,
        demandStatus: r.status === "approved" ? demandStatusMap[r.title] || null : null,
      }));
    },
    enabled: !!user && !!selectedTeamId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="p-4 md:p-6 pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <div className="flex gap-3 overflow-hidden">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="min-w-[260px] h-32 rounded-xl flex-shrink-0" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="px-4 md:px-6 pt-3 md:pt-4 pb-1">
        <CardTitle className="text-base md:text-lg flex items-center gap-2">
          <History className="h-4 w-4 md:h-5 md:w-5 text-primary" />
          Últimas Solicitações
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0">
        {!requests || requests.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma solicitação encontrada</p>
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
            {requests.map((req: any) => {
              const config = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
              return (
                <div
                  key={req.id}
                  className="min-w-[240px] md:min-w-[280px] snap-start flex-shrink-0 rounded-xl border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer space-y-2.5"
                  onClick={() => navigate(`/demand-requests?highlight=${req.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm leading-tight line-clamp-2 flex-1">
                      {req.title}
                    </p>
                    <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${config.className}`}>
                      {config.label}
                    </Badge>
                  </div>

                  {req.service?.name && (
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                      <Tag className="h-3 w-3 shrink-0" />
                      {req.service.name}
                    </p>
                  )}

                  {req.board?.name && (
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                      <Layout className="h-3 w-3 shrink-0" />
                      {req.board.name}
                    </p>
                  )}

                  {req.demandStatus && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-muted-foreground">Status Atual:</span>
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: req.demandStatus.color }}
                      />
                      <span className="text-xs font-medium truncate">
                        {req.demandStatus.name}
                      </span>
                    </div>
                  )}

                  <div className="flex flex-col gap-1 pt-1 border-t border-border/50">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <CalendarDays className="h-2.5 w-2.5 shrink-0" />
                      Criada em {format(new Date(req.created_at), "dd MMM yyyy", { locale: ptBR })}
                    </p>
                    {req.status === "approved" && req.responded_at && (
                      <p className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle className="h-2.5 w-2.5 shrink-0" />
                        Aprovada em {format(new Date(req.responded_at), "dd MMM yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
