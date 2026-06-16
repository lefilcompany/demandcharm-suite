import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, AlertCircle, BarChart3, CheckCircle2, 
  AlertTriangle, Timer, Clock, Users, Target, Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { getSharedSummary, BoardSummaryHistoryItem } from "@/hooks/useBoardSummaryHistory";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import logoSoma from "@/assets/logo-soma.png";
import { SEOHead } from "@/components/SEOHead";

type SummaryData = {
  id: string;
  summary_text: string;
  analytics_data: BoardSummaryHistoryItem["analytics_data"];
  created_at: string;
  board: { name: string } | null;
};

function QuickStatsCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  variant = "default" 
}: { 
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const variantStyles = {
    default: "bg-muted/50 text-foreground",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  };

  const iconStyles = {
    default: "text-muted-foreground",
    success: "text-emerald-500",
    warning: "text-amber-500",
    danger: "text-red-500",
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-lg", variantStyles[variant])}>
            <Icon className={cn("h-5 w-5", iconStyles[variant])} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold text-foreground truncate">{value}</p>
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            {subValue && (
              <p className="text-xs text-muted-foreground/70 truncate">{subValue}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MemberPerformanceCard({ member }: { member: BoardSummaryHistoryItem["analytics_data"]["members"][0] }) {
  const roleLabels: Record<string, string> = {
    admin: "Administrador",
    moderator: "Moderador",
    executor: "Executor",
    requester: "Solicitante",
  };

  const roleBadgeColors: Record<string, string> = {
    admin: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    moderator: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    executor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    requester: "bg-muted text-muted-foreground",
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-sm font-medium text-primary">
            {member.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{member.name}</p>
          <span className={cn("text-xs px-2 py-0.5 rounded-full", roleBadgeColors[member.role] || roleBadgeColors.requester)}>
            {roleLabels[member.role] || member.role}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium">{member.completedCount}/{member.demandCount}</p>
        <p className="text-xs text-muted-foreground">{member.completionRate}% concluído</p>
      </div>
    </div>
  );
}

export default function SharedBoardSummary() {
  const { token } = useParams<{ token: string }>();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadSummary() {
      if (!token) {
        setError("Token não fornecido");
        setIsLoading(false);
        return;
      }

      try {
        const data = await getSharedSummary(token);
        setSummary(data as SummaryData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar análise");
      } finally {
        setIsLoading(false);
      }
    }

    loadSummary();
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-primary animate-spin" />
          <span className="text-muted-foreground">Carregando análise...</span>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Acesso Negado</h2>
            <p className="text-muted-foreground text-center">
              {error || "Esta análise não está disponível ou o link expirou."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const analytics = summary.analytics_data;
  const onTimeRate = analytics?.demands 
    ? analytics.demands.onTime + analytics.demands.late > 0
      ? Math.round((analytics.demands.onTime / (analytics.demands.onTime + analytics.demands.late)) * 100)
      : 0
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={summary.board?.name ? `Análise IA - ${summary.board.name}` : "Análise IA Compartilhada"} />
      <div className="container mx-auto py-6 px-4 max-w-5xl">
        {/* Header with Logo */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <img src={logoSoma} alt="Soma+" className="h-8" />
          </div>
          <Badge variant="secondary" className="gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Visualização Pública
          </Badge>
        </div>

        {/* Summary Header */}
        <Card className="overflow-hidden border-0 shadow-lg mb-6">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Análise Inteligente</h1>
                <p className="text-sm text-muted-foreground">
                  Quadro: <span className="font-medium text-foreground">{summary.board?.name || "—"}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Gerado em {format(new Date(summary.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Quick Stats */}
        {analytics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <QuickStatsCard
              icon={BarChart3}
              label="Total de Demandas"
              value={analytics.demands.total}
              subValue={`${analytics.demands.delivered} entregues`}
              variant="default"
            />
            <QuickStatsCard
              icon={CheckCircle2}
              label="Entregas no Prazo"
              value={`${onTimeRate}%`}
              subValue={`${analytics.demands.onTime} de ${analytics.demands.onTime + analytics.demands.late}`}
              variant={onTimeRate >= 80 ? "success" : onTimeRate >= 60 ? "warning" : "danger"}
            />
            <QuickStatsCard
              icon={AlertTriangle}
              label="Demandas Atrasadas"
              value={analytics.demands.overdue}
              subValue="prazo vencido"
              variant={analytics.demands.overdue === 0 ? "success" : analytics.demands.overdue <= 3 ? "warning" : "danger"}
            />
            <QuickStatsCard
              icon={Timer}
              label="Tempo Médio"
              value={`${analytics.demands.avgDeliveryDays} dias`}
              subValue="por demanda"
              variant="default"
            />
          </div>
        )}

        {/* Team and Time */}
        {analytics && (
          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Equipe</CardTitle>
                </div>
                <CardDescription>Performance dos membros</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 max-h-64 overflow-y-auto">
                {analytics.members.length > 0 ? (
                  analytics.members
                    .filter(m => m.demandCount > 0)
                    .sort((a, b) => b.completionRate - a.completionRate)
                    .map((member, i) => (
                      <MemberPerformanceCard key={i} member={member} />
                    ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum membro com demandas atribuídas
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <CardTitle className="text-base">Tempo Investido</CardTitle>
                </div>
                <CardDescription>Horas registradas por executor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <span className="text-sm font-medium">Total de Horas</span>
                  <span className="text-lg font-bold text-primary">{analytics.timeTracking.totalHours}h</span>
                </div>
                {analytics.timeTracking.byExecutor.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {analytics.timeTracking.byExecutor
                      .sort((a, b) => b.hours - a.hours)
                      .map((executor, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{executor.name}</span>
                          <span className="font-medium">{executor.hours}h ({executor.demandCount} demandas)</span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Nenhum tempo registrado
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI Summary */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Relatório de Análise</CardTitle>
                <CardDescription>Gerado por IA com base nos dados do quadro</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  h2: ({ children }) => (
                    <h2 className="text-lg font-semibold mt-6 mb-3 flex items-center gap-2 text-foreground first:mt-0">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-medium mt-4 mb-2 text-foreground">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-muted-foreground leading-relaxed mb-3">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="space-y-1.5 my-3 ml-1">
                      {children}
                    </ul>
                  ),
                  li: ({ children }) => (
                    <li className="text-muted-foreground flex items-start gap-2">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      <span>{children}</span>
                    </li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-foreground">
                      {children}
                    </strong>
                  ),
                }}
              >
                {summary.summary_text}
              </ReactMarkdown>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 space-y-2">
          <p className="text-sm text-muted-foreground">
            Análise gerada pelo <span className="font-medium text-foreground">Soma+</span> · Gestão Inteligente de Demandas
          </p>
          <p className="text-xs text-muted-foreground/70">
            Este é um link de visualização pública. Apenas leitura.
          </p>
        </div>
      </div>
    </div>
  );
}
