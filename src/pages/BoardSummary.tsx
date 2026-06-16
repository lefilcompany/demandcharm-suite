import { useState, useCallback, useEffect } from "react";
import { useSelectedBoardSafe } from "@/contexts/BoardContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Sparkles, RefreshCw, AlertCircle, TrendingUp, AlertTriangle, 
  CheckCircle2, Clock, Target, Lightbulb, Users, BarChart3,
  Timer, Copy, Download, Share2
} from "lucide-react";
import { toast } from "sonner";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import ReactMarkdown from "react-markdown";
import { useBoardSummaryHistory, BoardSummaryHistoryItem } from "@/hooks/useBoardSummaryHistory";
import { SummaryHistoryDrawer } from "@/components/SummaryHistoryDrawer";
import { generateBoardSummaryPDF } from "@/lib/pdfExport";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SEOHead } from "@/components/SEOHead";

interface LateDemandDetail {
  title: string;
  daysLate: number;
  dueDate: string;
  deliveredAt: string;
  assignees: string[];
  priority: string;
}

interface OverdueDemandDetail {
  title: string;
  daysOverdue: number;
  dueDate: string;
  assignees: string[];
  priority: string;
  status: string;
}

interface BoardAnalytics {
  board: { name: string; description: string | null; monthlyLimit: number | null };
  period: { start: string; end: string; days: number };
  demands: {
    total: number;
    delivered: number;
    onTime: number;
    late: number;
    overdue: number;
    avgDeliveryDays: number;
    avgDaysLate?: number;
    avgDaysOverdue?: number;
    withDueDate?: number;
    withoutDueDate?: number;
    onTimeRate?: number;
    lateDetails?: LateDemandDetail[];
    overdueDetails?: OverdueDemandDetail[];
    byStatus: { status: string; count: number }[];
    byPriority: { priority: string; count: number }[];
  };
  members: {
    name: string;
    role: string;
    demandCount: number;
    completedCount: number;
    onTimeCount?: number;
    lateCount?: number;
    completionRate: number;
    onTimeRate?: number;
    avgTimeHours: number;
  }[];
  requesters: {
    name: string;
    requestCount: number;
    pending: number;
    approved: number;
    rejected: number;
    avgPerWeek: number;
  }[];
  timeTracking: {
    totalHours: number;
    byExecutor: { name: string; hours: number; demandCount: number }[];
    avgHoursPerDemand: number;
  };
}

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
      <CardContent className="p-2.5 sm:p-3">
        <div className="flex items-center gap-2 sm:flex-col sm:items-start sm:gap-2">
          <div className="flex items-center gap-2 sm:w-full">
            <div className={cn("p-1.5 rounded-md shrink-0", variantStyles[variant])}>
              <Icon className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", iconStyles[variant])} />
            </div>
            <p className="text-[10px] sm:text-xs font-medium text-muted-foreground leading-tight">{label}</p>
          </div>
          <div className="ml-auto sm:ml-0 text-right sm:text-left">
            <p className="text-base sm:text-xl font-bold text-foreground">{value}</p>
            {subValue && (
              <p className="text-[10px] sm:text-[11px] text-muted-foreground/80 hidden sm:block">{subValue}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MemberPerformanceCard({ member }: { member: BoardAnalytics["members"][0] }) {
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

  // Use new onTimeRate if available
  const memberOnTimeRate = member.onTimeRate ?? 0;
  const hasOnTimeData = member.onTimeCount !== undefined || member.lateCount !== undefined;

  return (
    <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/30 border border-border/50 gap-2">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
        <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-xs sm:text-sm font-medium text-primary">
            {member.name.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-xs sm:text-sm truncate">{member.name}</p>
          <span className={cn("text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 rounded-full", roleBadgeColors[member.role] || roleBadgeColors.requester)}>
            {roleLabels[member.role] || member.role}
          </span>
        </div>
      </div>
      <div className="text-right shrink-0 space-y-0.5">
        <p className="text-xs sm:text-sm font-medium">{member.completedCount}/{member.demandCount}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground">{member.completionRate}%</p>
        {hasOnTimeData && (
          <p className={cn(
            "text-[10px] sm:text-xs font-medium",
            memberOnTimeRate >= 80 ? "text-emerald-600 dark:text-emerald-400" :
            memberOnTimeRate >= 60 ? "text-amber-600 dark:text-amber-400" :
            "text-red-600 dark:text-red-400"
          )}>
            {memberOnTimeRate}%
          </p>
        )}
      </div>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted animate-pulse" />
                <div className="space-y-2 flex-1">
                  <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="h-5 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-full bg-muted animate-pulse rounded" />
            <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
            <div className="h-4 w-5/6 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function BoardSummary() {
  const { currentBoard } = useSelectedBoardSafe();
  const [summary, setSummary] = useState("");
  const [analytics, setAnalytics] = useState<BoardAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSummaryId, setCurrentSummaryId] = useState<string | null>(null);
  
  const { saveSummary, createShareToken } = useBoardSummaryHistory(currentBoard?.id);

  const generateSummary = useCallback(async () => {
    if (!currentBoard?.id) {
      toast.error("Selecione um quadro primeiro");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSummary("");
    setAnalytics(null);
    setCurrentSummaryId(null);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error("Você precisa estar logado para gerar a análise");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/board-summary`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ boardId: currentBoard.id }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erro ao gerar análise");
      }

      if (!response.body) {
        throw new Error("Stream não disponível");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let summaryText = "";
      let analyticsData: BoardAnalytics | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            
            if (parsed.type === "analytics" && parsed.data) {
              analyticsData = parsed.data;
              setAnalytics(parsed.data);
              continue;
            }
            
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              summaryText += content;
              setSummary(summaryText);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Save to history after generation is complete
      if (summaryText && analyticsData) {
        const saved = await saveSummary.mutateAsync({
          boardId: currentBoard.id,
          summaryText,
          analyticsData,
        });
        if (saved) {
          setCurrentSummaryId(saved.id);
        }
      }
    } catch (err) {
      console.error("Error generating summary:", err);
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [currentBoard?.id, saveSummary]);

  const handleSelectFromHistory = (item: BoardSummaryHistoryItem) => {
    setSummary(item.summary_text);
    setAnalytics(item.analytics_data);
    setCurrentSummaryId(item.id);
    setError(null);
  };

  const handleCopy = async () => {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      toast.success("Análise copiada para a área de transferência");
    } catch {
      toast.error("Erro ao copiar análise");
    }
  };

  const handleExportPDF = async () => {
    if (!summary || !analytics) return;

    try {
      await generateBoardSummaryPDF({
        boardName: analytics.board.name || "Quadro",
        createdAt: new Date(),
        summaryText: summary,
        analytics,
      });
      toast.success("PDF exportado com sucesso");
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("Erro ao exportar PDF");
    }
  };

  const handleShare = async () => {
    if (!currentSummaryId) {
      toast.error("Gere uma análise primeiro para compartilhar");
      return;
    }
    
    const result = await createShareToken.mutateAsync(currentSummaryId);
    if (result) {
      const shareUrl = `${window.location.origin}/shared/summary/${result.token}`;
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link de compartilhamento copiado!");
    }
  };

  // Use the new onTimeRate from analytics if available, otherwise calculate legacy way
  const onTimeRate = analytics?.demands?.onTimeRate !== undefined
    ? analytics.demands.onTimeRate
    : analytics?.demands 
      ? analytics.demands.onTime + analytics.demands.late > 0
        ? Math.round((analytics.demands.onTime / (analytics.demands.onTime + analytics.demands.late)) * 100)
        : 0
      : 0;

  if (!currentBoard) {
    return (
      <div className="container mx-auto py-6 px-4">
        <SEOHead title="Análise IA" />
        <PageBreadcrumb items={[{ label: "Análise IA", icon: Sparkles }]} />
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Selecione um quadro para gerar a análise por IA
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl px-2 sm:px-4">
      <SEOHead title={`Análise IA - ${currentBoard.name}`} />
      <PageBreadcrumb items={[{ label: "Análise IA", icon: Sparkles }]} />
      
      <div className="mt-4 sm:mt-6 space-y-4 sm:space-y-6">
        {/* Header Card */}
        <Card className="overflow-hidden border-0 shadow-lg">
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/25">
                  <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold text-foreground">Análise Inteligente</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate max-w-[200px] sm:max-w-none">
                    Quadro: <span className="font-medium text-foreground">{currentBoard.name}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <SummaryHistoryDrawer 
                  boardId={currentBoard.id} 
                  onSelectSummary={handleSelectFromHistory} 
                />
                
                {summary && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 h-8 sm:h-9">
                        <Share2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline text-sm">Ações</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleCopy}>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar texto
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleShare}>
                        <Share2 className="h-4 w-4 mr-2" />
                        Compartilhar link
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                
                <Button
                  onClick={generateSummary}
                  disabled={isLoading}
                  size="sm"
                  className="gap-1.5 shadow-md h-8 sm:h-9 text-xs sm:text-sm"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                      <span className="hidden xs:inline">Analisando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      {analytics ? "Atualizar" : "Gerar"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <p className="font-medium">{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {isLoading && !analytics && <AnalyticsSkeleton />}

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
            <QuickStatsCard
              icon={BarChart3}
              label="Total"
              value={analytics.demands.total}
              subValue={`${analytics.demands.delivered} entregues`}
              variant="default"
            />
            <QuickStatsCard
              icon={CheckCircle2}
              label="No Prazo"
              value={`${onTimeRate}%`}
              subValue={`${analytics.demands.onTime} de ${analytics.demands.withDueDate || (analytics.demands.onTime + analytics.demands.late)}`}
              variant={onTimeRate >= 80 ? "success" : onTimeRate >= 60 ? "warning" : "danger"}
            />
            <QuickStatsCard
              icon={AlertTriangle}
              label="Atrasadas"
              value={analytics.demands.late}
              subValue={analytics.demands.avgDaysLate ? `média ${analytics.demands.avgDaysLate}d` : "após prazo"}
              variant={analytics.demands.late === 0 ? "success" : analytics.demands.late <= 3 ? "warning" : "danger"}
            />
            <QuickStatsCard
              icon={AlertCircle}
              label="Vencidas"
              value={analytics.demands.overdue}
              subValue={analytics.demands.avgDaysOverdue ? `média ${analytics.demands.avgDaysOverdue}d` : "pendentes"}
              variant={analytics.demands.overdue === 0 ? "success" : analytics.demands.overdue <= 2 ? "warning" : "danger"}
            />
            <QuickStatsCard
              icon={Timer}
              label="Tempo Médio"
              value={`${analytics.demands.avgDeliveryDays}d`}
              subValue="por demanda"
              variant="default"
            />
          </div>
        )}

        {/* Additional Stats */}
        {analytics && (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            {/* Team Performance */}
            <Card>
              <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  <CardTitle className="text-sm sm:text-base">Equipe</CardTitle>
                </div>
                <CardDescription className="text-xs sm:text-sm">Performance dos membros</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 sm:space-y-2 max-h-52 sm:max-h-64 overflow-y-auto px-3 sm:px-6 pb-3 sm:pb-6">
                {analytics.members.length > 0 ? (
                  analytics.members
                    .filter(m => m.demandCount > 0)
                    .sort((a, b) => b.completionRate - a.completionRate)
                    .map((member, i) => (
                      <MemberPerformanceCard key={i} member={member} />
                    ))
                ) : (
                  <p className="text-xs sm:text-sm text-muted-foreground text-center py-4">
                    Nenhum membro com demandas atribuídas
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Time Tracking */}
            <Card>
              <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6 pt-3 sm:pt-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  <CardTitle className="text-sm sm:text-base">Tempo Investido</CardTitle>
                </div>
                <CardDescription className="text-xs sm:text-sm">Horas por executor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3 px-3 sm:px-6 pb-3 sm:pb-6">
                <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <span className="text-xs sm:text-sm font-medium">Total</span>
                  <span className="text-base sm:text-lg font-bold text-primary">{analytics.timeTracking.totalHours}h</span>
                </div>
                {analytics.timeTracking.byExecutor.length > 0 ? (
                  <div className="space-y-1.5 sm:space-y-2 max-h-32 sm:max-h-40 overflow-y-auto">
                    {analytics.timeTracking.byExecutor
                      .sort((a, b) => b.hours - a.hours)
                      .map((executor, i) => (
                        <div key={i} className="flex items-center justify-between text-xs sm:text-sm gap-2">
                          <span className="text-muted-foreground truncate flex-1">{executor.name}</span>
                          <span className="font-medium shrink-0">
                            {executor.hours > 0 
                              ? `${executor.hours}h` 
                              : "Sem registro"}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-muted-foreground text-center py-2">
                    Nenhum tempo registrado
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI Summary */}
        {(summary || (isLoading && analytics)) && (
          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30 px-3 sm:px-6 py-3 sm:py-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10">
                  <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm sm:text-lg">Relatório de Análise</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">Gerado por IA</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {summary ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      h2: ({ children }) => (
                        <h2 className="text-base sm:text-lg font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 flex items-center gap-2 text-foreground first:mt-0">
                          {children}
                        </h2>
                      ),
                      h3: ({ children }) => (
                        <h3 className="text-sm sm:text-base font-medium mt-3 sm:mt-4 mb-1.5 sm:mb-2 text-foreground">
                          {children}
                        </h3>
                      ),
                      p: ({ children }) => (
                        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-2 sm:mb-3">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="space-y-1 sm:space-y-1.5 my-2 sm:my-3 ml-1">
                          {children}
                        </ul>
                      ),
                      li: ({ children }) => (
                        <li className="text-xs sm:text-sm text-muted-foreground flex items-start gap-1.5 sm:gap-2">
                          <span className="inline-block w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary mt-1.5 sm:mt-2 shrink-0" />
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
                    {summary}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center justify-center py-6 sm:py-8 gap-2 sm:gap-3">
                  <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-primary" />
                  <span className="text-xs sm:text-sm text-muted-foreground">Gerando análise...</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!isLoading && !analytics && !error && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 sm:py-16 px-4">
              <div className="relative mb-4 sm:mb-6">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
                <div className="relative p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-muted to-muted/50 border border-border/50">
                  <Sparkles className="h-8 w-8 sm:h-12 sm:w-12 text-primary/60" />
                </div>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1.5 sm:mb-2 text-center">
                Pronto para analisar seu quadro
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground text-center max-w-md mb-4 sm:mb-6">
                Clique em "Gerar" para criar um relatório com insights sobre demandas e performance.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                  <span>Performance</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary/70" />
                  <span>Equipe</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Lightbulb className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary/50" />
                  <span>Recomendações</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
