import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Activity, 
  FileText, 
  PlayCircle, 
  AlertCircle,
  FilePlus,
  UserCheck,
  Package
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { truncateText } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface BoardActivity {
  id: string;
  type: 'demand_created' | 'demand_delivered' | 'demand_started' | 'request_created' | 'request_approved' | 'request_rejected';
  title: string;
  demandId?: string;
  requestId?: string;
  timestamp: string;
  actionBy?: string;
  createdBy?: string;
}

export function RecentActivities() {
  const { selectedBoardId, currentBoard } = useSelectedBoard();
  const navigate = useNavigate();

  // Buscar demandas recentes criadas no quadro
  const { data: recentDemands } = useQuery({
    queryKey: ["recent-demands-created", selectedBoardId],
    queryFn: async () => {
      if (!selectedBoardId) return [];
      
      const { data, error } = await supabase
        .from("demands")
        .select(`
          id,
          title,
          created_at,
          creator:profiles!demands_created_by_fkey(full_name)
        `)
        .eq("board_id", selectedBoardId)
        .order("created_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBoardId,
  });

  // Buscar demandas entregues recentemente no quadro
  const { data: deliveredDemands } = useQuery({
    queryKey: ["recent-demands-delivered", selectedBoardId],
    queryFn: async () => {
      if (!selectedBoardId) return [];
      
      const { data: deliveredStatus } = await supabase
        .from("demand_statuses")
        .select("id")
        .eq("name", "Entregue")
        .single();
      
      if (!deliveredStatus) return [];
      
      const { data, error } = await supabase
        .from("demands")
        .select(`
          id,
          title,
          updated_at,
          creator:profiles!demands_created_by_fkey(full_name),
          demand_assignees(
            profile:profiles(full_name)
          )
        `)
        .eq("board_id", selectedBoardId)
        .eq("status_id", deliveredStatus.id)
        .order("updated_at", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBoardId,
  });

  // Buscar solicitações de demanda recentes do quadro
  const { data: recentRequests } = useQuery({
    queryKey: ["recent-requests", selectedBoardId],
    queryFn: async () => {
      if (!selectedBoardId) return [];
      
      const { data, error } = await supabase
        .from("demand_requests")
        .select(`
          id,
          title,
          status,
          created_at,
          updated_at,
          creator:profiles!demand_requests_created_by_fkey(full_name),
          responder:profiles!demand_requests_responded_by_fkey(full_name)
        `)
        .eq("board_id", selectedBoardId)
        .order("updated_at", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    },
    enabled: !!selectedBoardId,
  });

  // Combinar e ordenar todas as atividades
  const activities: BoardActivity[] = [];

  // Adicionar demandas criadas
  recentDemands?.forEach((demand: any) => {
    activities.push({
      id: `demand-created-${demand.id}`,
      type: 'demand_created',
      title: demand.title,
      demandId: demand.id,
      timestamp: demand.created_at,
      actionBy: demand.creator?.full_name,
    });
  });

  // Adicionar demandas entregues
  deliveredDemands?.forEach((demand: any) => {
    const assigneeNames = demand.demand_assignees
      ?.map((a: any) => a.profile?.full_name)
      .filter(Boolean)
      .join(", ");
    
    activities.push({
      id: `demand-delivered-${demand.id}`,
      type: 'demand_delivered',
      title: demand.title,
      demandId: demand.id,
      timestamp: demand.updated_at,
      actionBy: assigneeNames || demand.creator?.full_name,
      createdBy: demand.creator?.full_name,
    });
  });

  // Adicionar solicitações
  recentRequests?.forEach((request: any) => {
    let type: BoardActivity['type'] = 'request_created';
    let actionBy = request.creator?.full_name;
    
    if (request.status === 'approved') {
      type = 'request_approved';
      actionBy = request.responder?.full_name;
    } else if (request.status === 'rejected') {
      type = 'request_rejected';
      actionBy = request.responder?.full_name;
    }
    
    activities.push({
      id: `request-${request.id}-${request.status}`,
      type,
      title: request.title,
      requestId: request.id,
      timestamp: request.status === 'pending' ? request.created_at : request.updated_at,
      actionBy,
      createdBy: request.creator?.full_name,
    });
  });

  // Ordenar por timestamp (mais recente primeiro)
  const sortedActivities = activities
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 15);

  const getActivityConfig = (type: BoardActivity['type']) => {
    switch (type) {
      case 'demand_created':
        return {
          icon: <FilePlus className="h-4 w-4 text-primary" />,
          label: "Nova demanda",
          actionLabel: "Criada por",
          badgeClass: "bg-primary/10 text-primary border-primary/20",
        };
      case 'demand_delivered':
        return {
          icon: <Package className="h-4 w-4 text-green-500" />,
          label: "Entregue",
          actionLabel: "Entregue por",
          badgeClass: "bg-green-500/10 text-green-600 border-green-500/20",
        };
      case 'demand_started':
        return {
          icon: <PlayCircle className="h-4 w-4 text-blue-500" />,
          label: "Em execução",
          actionLabel: "Iniciada por",
          badgeClass: "bg-blue-500/10 text-blue-600 border-blue-500/20",
        };
      case 'request_created':
        return {
          icon: <FileText className="h-4 w-4 text-amber-500" />,
          label: "Nova solicitação",
          actionLabel: "Solicitada por",
          badgeClass: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        };
      case 'request_approved':
        return {
          icon: <UserCheck className="h-4 w-4 text-green-500" />,
          label: "Aprovada",
          actionLabel: "Aprovada por",
          badgeClass: "bg-green-500/10 text-green-600 border-green-500/20",
        };
      case 'request_rejected':
        return {
          icon: <AlertCircle className="h-4 w-4 text-red-500" />,
          label: "Rejeitada",
          actionLabel: "Rejeitada por",
          badgeClass: "bg-red-500/10 text-red-600 border-red-500/20",
        };
      default:
        return {
          icon: <Activity className="h-4 w-4 text-muted-foreground" />,
          label: "Atividade",
          actionLabel: "Por",
          badgeClass: "bg-muted text-muted-foreground",
        };
    }
  };

  const handleClick = (activity: BoardActivity) => {
    if (activity.demandId) {
      navigate(`/demands/${activity.demandId}`);
    } else if (activity.requestId) {
      navigate(`/demand-requests`);
    }
  };

  const isLoading = !recentDemands && !deliveredDemands && !recentRequests;

  if (!selectedBoardId) {
    return null;
  }

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle className="text-sm md:text-base font-bold tracking-wider uppercase text-foreground text-center flex items-center justify-center gap-2">
          <Activity className="h-4 w-4 md:h-5 md:w-5 text-foreground" />
          Atividades do Quadro
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-[300px] xl:min-h-0 relative">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : sortedActivities.length > 0 ? (
          <div className="absolute inset-0 px-6 pb-6">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-3">
              {sortedActivities.map((activity) => {
                const config = getActivityConfig(activity.type);
                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleClick(activity)}
                  >
                    <div className="mt-0.5 p-1.5 rounded-full bg-muted/50">
                      {config.icon}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge 
                          variant="outline" 
                          className={`text-[10px] px-1.5 py-0 h-5 ${config.badgeClass}`}
                        >
                          {config.label}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.timestamp), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      <p className="text-sm font-medium line-clamp-2" title={activity.title}>
                        {activity.title}
                      </p>
                      <p className="text-xs text-muted-foreground break-words">
                        <span className="text-muted-foreground/70">{config.actionLabel}:</span>{" "}
                        <span className="font-medium">{activity.actionBy || "Sistema"}</span>
                        {activity.createdBy && activity.createdBy !== activity.actionBy && (
                          <span className="text-muted-foreground/60">
                            {" "}• Solicitante: {activity.createdBy}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Nenhuma atividade recente</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
