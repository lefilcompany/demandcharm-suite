import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, AlertTriangle, CheckCircle, Info, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface AIInsight {
  title: string;
  description: string;
  type: "warning" | "success" | "info";
}

interface DashboardAIInsightsProps {
  boardId: string | null;
  isRequester?: boolean;
}

const typeConfig = {
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-500/10 dark:bg-amber-500/15",
    border: "border-amber-500/20",
    iconColor: "text-amber-500",
    titleColor: "text-amber-700 dark:text-amber-400",
  },
  success: {
    icon: CheckCircle,
    bg: "bg-emerald-500/10 dark:bg-emerald-500/15",
    border: "border-emerald-500/20",
    iconColor: "text-emerald-500",
    titleColor: "text-emerald-700 dark:text-emerald-400",
  },
  info: {
    icon: Info,
    bg: "bg-primary/10",
    border: "border-primary/20",
    iconColor: "text-primary",
    titleColor: "text-primary",
  },
};

function InsightCard({ insight, isExpanded, onToggle }: { insight: AIInsight; isExpanded: boolean; onToggle: () => void }) {
  const config = typeConfig[insight.type] || typeConfig.info;
  const Icon = config.icon;
  const descRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const checkTruncation = useCallback(() => {
    const el = descRef.current;
    if (el) {
      setIsTruncated(el.scrollHeight > el.clientHeight + 1);
    }
  }, []);

  useEffect(() => {
    checkTruncation();
    window.addEventListener("resize", checkTruncation);
    return () => window.removeEventListener("resize", checkTruncation);
  }, [checkTruncation]);

  return (
    <Card className={`p-3 md:p-4 border ${config.border} ${config.bg} transition-all duration-300 hover:shadow-md`}>
      <div className="flex items-start gap-2.5">
        <div className="p-1.5 rounded-lg bg-background/60 shrink-0">
          <Icon className={`h-4 w-4 ${config.iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold leading-tight ${config.titleColor}`}>
            {insight.title}
          </p>
          <p
            ref={descRef}
            className={`text-xs text-muted-foreground mt-1 whitespace-pre-line ${isExpanded ? "" : "line-clamp-2"}`}
          >
            {insight.description}
          </p>
          {(isTruncated || isExpanded) && (
            <button
              onClick={onToggle}
              className="text-[11px] font-medium text-primary hover:underline mt-1.5 inline-block"
            >
              {isExpanded ? "Ver menos" : "Ler mais"}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function DashboardAIInsights({ boardId }: DashboardAIInsightsProps) {
  const navigate = useNavigate();
  const [expandedIndexes, setExpandedIndexes] = useState<Set<number>>(new Set());

  // Cleanup of legacy localStorage cache (one-time per session)
  useEffect(() => {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("soma:ai-insights:")) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-ai-insights", boardId],
    queryFn: async () => {
      if (!boardId) return { insights: [] as AIInsight[] };

      const { data, error } = await supabase.functions.invoke("dashboard-ai-insights", {
        body: { board_id: boardId },
      });
      if (error) {
        const msg = typeof error === "object" && "message" in error ? (error as any).message : String(error);
        if (msg.includes("402") || msg.includes("Payment") || msg.includes("429") || msg.includes("Rate limit")) {
          return { insights: [] as AIInsight[] };
        }
        if (msg.includes("401") || msg.includes("Unauthorized")) {
          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError || !refreshed.session) return { insights: [] as AIInsight[] };
          const { data: retryData, error: retryError } = await supabase.functions.invoke("dashboard-ai-insights", {
            body: { board_id: boardId },
          });
          if (retryError) return { insights: [] as AIInsight[] };
          return retryData as { insights: AIInsight[] };
        }
        return { insights: [] as AIInsight[] };
      }
      return data as { insights: AIInsight[] };
    },
    enabled: !!boardId,
    staleTime: 5 * 60 * 1000, // server is source of truth for the 24h TTL
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
        <div className="h-28 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center gap-2 p-4">
          <Sparkles className="h-5 w-5 text-primary animate-pulse" />
          <p className="text-xs text-primary font-medium text-center">Gerando insights com IA…</p>
        </div>
      </div>
    );
  }

  if (error || !data?.insights?.length) return null;

  const insights = data.insights;
  const allExpanded = expandedIndexes.size === insights.length && insights.length > 0;

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedIndexes(new Set());
    } else {
      setExpandedIndexes(new Set(insights.map((_, i) => i)));
    }
  };

  return (
    <div className="space-y-2">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {insights.map((insight, i) => (
          <InsightCard
            key={i}
            insight={insight}
            isExpanded={expandedIndexes.has(i)}
            onToggle={toggleAll}
          />
        ))}

        <Card className="p-3 md:p-4 border-0 bg-primary flex flex-col justify-between transition-shadow hover:shadow-lg shadow-md">
          <div className="flex items-start gap-2.5">
            <div className="p-1.5 rounded-lg bg-white/20 shrink-0">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white leading-tight">
                Resumo Completo
              </p>
              <p className="text-xs text-white/70 mt-1">
                Gere uma análise detalhada com IA
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="mt-3 w-full gap-1.5 text-xs bg-white text-primary hover:bg-white/90 font-semibold"
            onClick={() => navigate("/board-summary")}
          >
            Gerar Resumo
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Card>
      </div>
    </div>
  );
}
