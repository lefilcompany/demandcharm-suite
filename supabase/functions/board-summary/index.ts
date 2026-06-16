import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Detailed late demand info
interface LateDemandDetail {
  title: string;
  daysLate: number;
  dueDate: string;
  deliveredAt: string;
  assignees: string[];
  priority: string;
}

// Detailed overdue demand info
interface OverdueDemandDetail {
  title: string;
  daysOverdue: number;
  dueDate: string;
  assignees: string[];
  priority: string;
  status: string;
}

interface DemandMetrics {
  total: number;
  delivered: number;
  onTime: number;
  late: number;
  overdue: number;
  avgDeliveryDays: number;
  avgDaysLate: number; // Average days late for late deliveries
  avgDaysOverdue: number; // Average days overdue for overdue demands
  withDueDate: number; // Total demands that have a due date
  withoutDueDate: number; // Total demands without due date
  onTimeRate: number; // Percentage of on-time deliveries (with due date)
  lateDetails: LateDemandDetail[]; // Detailed info about late demands
  overdueDetails: OverdueDemandDetail[]; // Detailed info about overdue demands
  byStatus: { status: string; count: number }[];
  byPriority: { priority: string; count: number }[];
}

interface MemberPerformance {
  name: string;
  role: string;
  demandCount: number;
  completedCount: number;
  onTimeCount: number;
  lateCount: number;
  completionRate: number;
  onTimeRate: number;
  avgTimeHours: number;
}

interface RequesterStats {
  name: string;
  requestCount: number;
  pending: number;
  approved: number;
  rejected: number;
  avgPerWeek: number;
}

interface TimeTrackingStats {
  totalHours: number;
  byExecutor: { name: string; hours: number; demandCount: number }[];
  avgHoursPerDemand: number;
}

interface BoardAnalytics {
  board: { name: string; description: string | null; monthlyLimit: number | null };
  period: { start: string; end: string; days: number };
  demands: DemandMetrics;
  members: MemberPerformance[];
  requesters: RequesterStats[];
  timeTracking: TimeTrackingStats;
  trends: {
    demandsByWeek: { week: string; count: number }[];
    deliveriesByWeek: { week: string; count: number }[];
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.error("Missing or invalid Authorization header");
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error("Failed to verify user:", userError);
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = user.id;

    const { boardId } = await req.json();
    
    if (!boardId) {
      return new Response(
        JSON.stringify({ error: "boardId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has access to the board
    const { data: membership, error: membershipError } = await supabase
      .from("board_members")
      .select("user_id")
      .eq("board_id", boardId)
      .eq("user_id", userId)
      .maybeSingle();

    if (membershipError) {
      console.error("Error checking board membership:", membershipError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar permissões" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!membership) {
      console.error("User", userId, "is not a member of board", boardId);
      return new Response(
        JSON.stringify({ error: "Você não tem acesso a este quadro" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate period (last 90 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    // Get board info
    const { data: board, error: boardError } = await supabaseAdmin
      .from("boards")
      .select("id, name, description, monthly_demand_limit")
      .eq("id", boardId)
      .single();

    if (boardError || !board) {
      console.error("Board error:", boardError);
      return new Response(
        JSON.stringify({ error: "Quadro não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all demands with comprehensive data
    const { data: demands, error: demandsError } = await supabaseAdmin
      .from("demands")
      .select(`
        id,
        title,
        description,
        priority,
        created_at,
        delivered_at,
        due_date,
        is_overdue,
        archived,
        time_in_progress_seconds,
        status:demand_statuses(name),
        service:services(name),
        assignees:demand_assignees(
          user_id,
          profile:profiles(full_name)
        )
      `)
      .eq("board_id", boardId)
      .eq("archived", false)
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: false });

    if (demandsError) {
      console.error("Demands error:", demandsError);
    }

    // Get board members with roles - specify the foreign key relationship
    const { data: members, error: membersError } = await supabaseAdmin
      .from("board_members")
      .select(`
        user_id,
        role,
        profile:profiles!board_members_user_id_fkey(full_name, avatar_url)
      `)
      .eq("board_id", boardId);

    if (membersError) {
      console.error("Members error:", membersError);
    }

    // Get time entries for the board
    const { data: timeEntries, error: timeError } = await supabaseAdmin
      .from("demand_time_entries")
      .select(`
        user_id,
        demand_id,
        duration_seconds,
        started_at,
        ended_at,
        demand:demands!inner(board_id)
      `)
      .eq("demand.board_id", boardId)
      .not("duration_seconds", "is", null);

    if (timeError) {
      console.error("Time entries error:", timeError);
    }

    // Get demand requests
    const { data: requests, error: requestsError } = await supabaseAdmin
      .from("demand_requests")
      .select(`
        id,
        title,
        status,
        priority,
        created_at,
        created_by,
        creator:profiles!demand_requests_created_by_fkey(full_name)
      `)
      .eq("board_id", boardId)
      .gte("created_at", startDate.toISOString());

    if (requestsError) {
      console.error("Requests error:", requestsError);
    }

    // Calculate demand metrics with detailed late/overdue tracking
    const demandsList = demands || [];
    const now = new Date();
    
    let delivered = 0;
    let onTime = 0;
    let late = 0;
    let overdue = 0;
    let totalDeliveryDays = 0;
    let totalDaysLate = 0;
    let totalDaysOverdue = 0;
    let withDueDate = 0;
    let withoutDueDate = 0;

    const lateDetails: LateDemandDetail[] = [];
    const overdueDetails: OverdueDemandDetail[] = [];
    const statusCounts: Record<string, number> = {};
    const priorityCounts: Record<string, number> = {};

    // Helper to normalize date comparison (ignore time, compare date only)
    const normalizeDate = (date: Date): Date => {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    };

    // Helper to get assignee names
    const getAssigneeNames = (assignees: any[]): string[] => {
      return (assignees || []).map((a: any) => a.profile?.full_name || "Usuário");
    };

    demandsList.forEach((d: any) => {
      const statusName = d.status?.name || "Sem status";
      statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;

      const priority = d.priority || "normal";
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;

      // Track due date presence
      if (d.due_date) {
        withDueDate++;
      } else {
        withoutDueDate++;
      }

      if (d.delivered_at) {
        delivered++;
        const deliveredDate = new Date(d.delivered_at);
        const createdDate = new Date(d.created_at);
        const days = (deliveredDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
        totalDeliveryDays += days;

        if (d.due_date) {
          // Normalize dates for accurate comparison (compare date only, not time)
          const dueDateNorm = normalizeDate(new Date(d.due_date));
          const deliveredDateNorm = normalizeDate(deliveredDate);
          
          // Calculate difference in days
          const diffMs = deliveredDateNorm.getTime() - dueDateNorm.getTime();
          const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
          
          if (diffDays <= 0) {
            // Delivered on time or early
            onTime++;
          } else {
            // Delivered late
            late++;
            totalDaysLate += diffDays;
            
            // Add to late details (limit to 20 for performance)
            if (lateDetails.length < 20) {
              lateDetails.push({
                title: d.title,
                daysLate: diffDays,
                dueDate: d.due_date,
                deliveredAt: d.delivered_at,
                assignees: getAssigneeNames(d.assignees),
                priority: d.priority || "normal",
              });
            }
          }
        }
      } else if (d.due_date) {
        // Not delivered yet - check if overdue
        const dueDateNorm = normalizeDate(new Date(d.due_date));
        const todayNorm = normalizeDate(now);
        
        const diffMs = todayNorm.getTime() - dueDateNorm.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0) {
          // Past due date
          overdue++;
          totalDaysOverdue += diffDays;
          
          // Add to overdue details (limit to 20 for performance)
          if (overdueDetails.length < 20) {
            overdueDetails.push({
              title: d.title,
              daysOverdue: diffDays,
              dueDate: d.due_date,
              assignees: getAssigneeNames(d.assignees),
              priority: d.priority || "normal",
              status: d.status?.name || "Sem status",
            });
          }
        }
      }
    });

    const avgDeliveryDays = delivered > 0 ? totalDeliveryDays / delivered : 0;
    const avgDaysLate = late > 0 ? totalDaysLate / late : 0;
    const avgDaysOverdue = overdue > 0 ? totalDaysOverdue / overdue : 0;
    
    // Calculate on-time rate only for demands that had a due date and were delivered
    const deliveredWithDueDate = onTime + late;
    const onTimeRate = deliveredWithDueDate > 0 ? Math.round((onTime / deliveredWithDueDate) * 100) : 0;

    // Sort late/overdue by severity (most days first)
    lateDetails.sort((a, b) => b.daysLate - a.daysLate);
    overdueDetails.sort((a, b) => b.daysOverdue - a.daysOverdue);

    const demandMetrics: DemandMetrics = {
      total: demandsList.length,
      delivered,
      onTime,
      late,
      overdue,
      avgDeliveryDays: Math.round(avgDeliveryDays * 10) / 10,
      avgDaysLate: Math.round(avgDaysLate * 10) / 10,
      avgDaysOverdue: Math.round(avgDaysOverdue * 10) / 10,
      withDueDate,
      withoutDueDate,
      onTimeRate,
      lateDetails,
      overdueDetails,
      byStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
      byPriority: Object.entries(priorityCounts).map(([priority, count]) => ({ priority, count })),
    };

    // Calculate member performance with on-time/late tracking
    const memberPerformance: MemberPerformance[] = [];
    const memberTimeMap: Record<string, number> = {};

    // Calculate time per member
    (timeEntries || []).forEach((entry: any) => {
      if (entry.user_id && entry.duration_seconds) {
        memberTimeMap[entry.user_id] = (memberTimeMap[entry.user_id] || 0) + entry.duration_seconds;
      }
    });

    // Build assignee demand map with on-time/late tracking
    const assigneeDemandMap: Record<string, { total: number; completed: number; onTime: number; late: number }> = {};
    
    demandsList.forEach((d: any) => {
      const assignees = d.assignees || [];
      const isDelivered = !!d.delivered_at;
      
      // Calculate if this demand was on-time or late
      let wasOnTime = false;
      let wasLate = false;
      
      if (isDelivered && d.due_date) {
        const dueDateNorm = normalizeDate(new Date(d.due_date));
        const deliveredDateNorm = normalizeDate(new Date(d.delivered_at));
        const diffMs = deliveredDateNorm.getTime() - dueDateNorm.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        
        wasOnTime = diffDays <= 0;
        wasLate = diffDays > 0;
      }
      
      assignees.forEach((a: any) => {
        if (!assigneeDemandMap[a.user_id]) {
          assigneeDemandMap[a.user_id] = { total: 0, completed: 0, onTime: 0, late: 0 };
        }
        assigneeDemandMap[a.user_id].total++;
        if (isDelivered) {
          assigneeDemandMap[a.user_id].completed++;
          if (wasOnTime) assigneeDemandMap[a.user_id].onTime++;
          if (wasLate) assigneeDemandMap[a.user_id].late++;
        }
      });
    });

    (members || []).forEach((m: any) => {
      const profile = m.profile as any;
      const stats = assigneeDemandMap[m.user_id] || { total: 0, completed: 0, onTime: 0, late: 0 };
      const timeSeconds = memberTimeMap[m.user_id] || 0;
      const timeHours = timeSeconds / 3600;
      
      // Calculate on-time rate for this member (only for completed demands with due date)
      const memberDeliveredWithDueDate = stats.onTime + stats.late;
      const memberOnTimeRate = memberDeliveredWithDueDate > 0 
        ? Math.round((stats.onTime / memberDeliveredWithDueDate) * 100) 
        : 0;

      memberPerformance.push({
        name: profile?.full_name || "Usuário",
        role: m.role,
        demandCount: stats.total,
        completedCount: stats.completed,
        onTimeCount: stats.onTime,
        lateCount: stats.late,
        completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
        onTimeRate: memberOnTimeRate,
        avgTimeHours: stats.completed > 0 ? Math.round((timeHours / stats.completed) * 10) / 10 : 0,
      });
    });

    // Calculate requester stats
    const requesterMap: Record<string, RequesterStats> = {};
    const weeksInPeriod = 90 / 7;

    (requests || []).forEach((r: any) => {
      const creatorName = (r.creator as any)?.full_name || "Usuário";
      if (!requesterMap[r.created_by]) {
        requesterMap[r.created_by] = {
          name: creatorName,
          requestCount: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          avgPerWeek: 0,
        };
      }
      requesterMap[r.created_by].requestCount++;
      if (r.status === "pending") requesterMap[r.created_by].pending++;
      if (r.status === "approved") requesterMap[r.created_by].approved++;
      if (r.status === "rejected") requesterMap[r.created_by].rejected++;
    });

    Object.values(requesterMap).forEach((r) => {
      r.avgPerWeek = Math.round((r.requestCount / weeksInPeriod) * 10) / 10;
    });

    const requesterStats = Object.values(requesterMap).sort((a, b) => b.requestCount - a.requestCount);

    // Calculate time tracking stats - include ALL board members (except requesters)
    let totalTimeSeconds = 0;
    const executorTimeMap: Record<string, { name: string; seconds: number; demandCount: number }> = {};

    // First, initialize all non-requester members with 0 hours
    (members || []).forEach((m: any) => {
      // Include admins, moderators, and executors in time tracking
      if (m.role !== 'requester') {
        const profile = m.profile as any;
        executorTimeMap[m.user_id] = {
          name: profile?.full_name || "Usuário",
          seconds: 0,
          demandCount: 0,
        };
      }
    });

    // Then add time entries
    (timeEntries || []).forEach((entry: any) => {
      if (entry.duration_seconds) {
        totalTimeSeconds += entry.duration_seconds;
        
        // If member exists in map, add to their time
        if (executorTimeMap[entry.user_id]) {
          executorTimeMap[entry.user_id].seconds += entry.duration_seconds;
        } else {
          // If not a board member anymore but has time entries, still include them
          const member = (members || []).find((m: any) => m.user_id === entry.user_id);
          const name = (member?.profile as any)?.full_name || "Usuário";
          executorTimeMap[entry.user_id] = { name, seconds: entry.duration_seconds, demandCount: 0 };
        }
      }
    });

    // Count unique demands per executor from time entries
    const executorDemands: Record<string, Set<string>> = {};
    (timeEntries || []).forEach((entry: any) => {
      if (!executorDemands[entry.user_id]) {
        executorDemands[entry.user_id] = new Set();
      }
      executorDemands[entry.user_id].add(entry.demand_id);
    });

    Object.entries(executorDemands).forEach(([userId, demandSet]) => {
      if (executorTimeMap[userId]) {
        executorTimeMap[userId].demandCount = demandSet.size;
      }
    });

    const timeTrackingStats: TimeTrackingStats = {
      totalHours: Math.round((totalTimeSeconds / 3600) * 10) / 10,
      byExecutor: Object.values(executorTimeMap)
        .sort((a, b) => b.seconds - a.seconds) // Sort by hours descending
        .map((e) => ({
          name: e.name,
          hours: Math.round((e.seconds / 3600) * 10) / 10,
          demandCount: e.demandCount,
        })),
      avgHoursPerDemand: delivered > 0 
        ? Math.round(((totalTimeSeconds / 3600) / delivered) * 10) / 10 
        : 0,
    };

    // Calculate trends (demands by week)
    const weeklyDemands: Record<string, number> = {};
    const weeklyDeliveries: Record<string, number> = {};

    demandsList.forEach((d: any) => {
      const createdWeek = getWeekLabel(new Date(d.created_at));
      weeklyDemands[createdWeek] = (weeklyDemands[createdWeek] || 0) + 1;

      if (d.delivered_at) {
        const deliveredWeek = getWeekLabel(new Date(d.delivered_at));
        weeklyDeliveries[deliveredWeek] = (weeklyDeliveries[deliveredWeek] || 0) + 1;
      }
    });

    const analytics: BoardAnalytics = {
      board: {
        name: board.name,
        description: board.description,
        monthlyLimit: board.monthly_demand_limit,
      },
      period: {
        start: startDate.toISOString().split("T")[0],
        end: endDate.toISOString().split("T")[0],
        days: 90,
      },
      demands: demandMetrics,
      members: memberPerformance,
      requesters: requesterStats,
      timeTracking: timeTrackingStats,
      trends: {
        demandsByWeek: Object.entries(weeklyDemands)
          .map(([week, count]) => ({ week, count }))
          .sort((a, b) => a.week.localeCompare(b.week)),
        deliveriesByWeek: Object.entries(weeklyDeliveries)
          .map(([week, count]) => ({ week, count }))
          .sort((a, b) => a.week.localeCompare(b.week)),
      },
    };

    const systemPrompt = `Você é um especialista em análise de gestão de projetos e produtividade de equipes. 
Sua tarefa é analisar os dados de um quadro Kanban e produzir um relatório executivo completo e preciso em português brasileiro.

IMPORTANTE - DEFINIÇÕES CRÍTICAS:
- "late" (Atrasadas): Demandas que FORAM ENTREGUES, mas DEPOIS da data de entrega prevista (due_date). Ou seja, foram finalizadas com atraso.
- "overdue" (Vencidas): Demandas que AINDA NÃO FORAM ENTREGUES e já passaram da data de entrega prevista. São pendências críticas.
- "onTime" (No Prazo): Demandas entregues NA ou ANTES da data prevista.
- "onTimeRate": Taxa percentual de entregas no prazo (apenas para demandas que tinham due_date definido).
- "avgDaysLate": Média de dias de atraso nas entregas atrasadas.
- "avgDaysOverdue": Média de dias que as demandas vencidas estão pendentes.
- "lateDetails": Lista detalhada das demandas entregues com atraso (título, dias de atraso, responsáveis).
- "overdueDetails": Lista detalhada das demandas vencidas pendentes (título, dias vencidos, responsáveis, status atual).

ANÁLISE DE MEMBROS:
- Cada membro tem "onTimeCount" (entregas no prazo) e "lateCount" (entregas atrasadas).
- "onTimeRate" por membro mostra a taxa individual de pontualidade.
- Use esses dados para identificar quem precisa de suporte ou está sobrecarregado.

REGRAS DE PRECISÃO:
- Use APENAS os números exatos fornecidos nos dados - NUNCA invente ou arredonde incorretamente
- Cite nomes de membros, títulos de demandas e valores exatamente como aparecem nos dados
- Diferencie claramente entre "atrasadas" (late - já entregues) e "vencidas" (overdue - ainda pendentes)

ESTRUTURA OBRIGATÓRIA DO RELATÓRIO:

## 📊 Resumo Executivo
[2-3 frases resumindo a situação geral do quadro, incluindo taxa de pontualidade e alertas críticos]

## 🎯 Métricas de Performance
- Taxa de entregas no prazo (onTimeRate): X% - baseado em Y demandas com data definida
- Total de demandas: X | Entregues: Y | No prazo: Z | Atrasadas: W | Vencidas: V
- Tempo médio de conclusão: X dias
- Média de dias de atraso (quando atrasadas): X dias
- Média de dias vencidas (demandas pendentes): X dias
- Demandas sem data definida: X (impacto na previsibilidade)

## 🚨 Demandas Críticas
### Vencidas (Pendentes - Ação Imediata)
[Liste cada demanda de overdueDetails com: título, dias vencidos, responsáveis, status atual, prioridade]

### Entregues com Atraso (Histórico)
[Liste as principais demandas de lateDetails com: título, dias de atraso, responsáveis]

## 👥 Análise da Equipe
Para cada membro (nome e cargo):
- Total de demandas: X | Concluídas: Y | No prazo: Z | Atrasadas: W
- Taxa de pontualidade individual: X%
- Horas investidas: X | Média por demanda: Y
- Avaliação: [Alta performance / Necessita suporte / etc.]

## 📈 Padrões de Demanda
- Distribuição por status
- Distribuição por prioridade
- Tendências semanais
- Padrões de solicitantes (requesters)

## ⚠️ Alertas e Riscos
- Gargalos identificados
- Membros sobrecarregados
- Riscos de novos atrasos

## 💡 Recomendações Acionáveis
- Ações imediatas para demandas vencidas
- Sugestões para melhorar pontualidade
- Redistribuição de carga se necessário

REGRAS FINAIS:
- Se lateDetails ou overdueDetails estiverem vazios, celebre a boa performance
- Sempre mencione nomes reais dos membros e demandas
- Priorize insights acionáveis sobre descrições genéricas
- Mantenha tom profissional mas acessível`;

    const userPrompt = `Analise os seguintes dados do quadro "${board.name}" dos últimos 90 dias.

ATENÇÃO: Os dados incluem informações detalhadas sobre:
- demands.lateDetails: Lista de demandas entregues COM ATRASO (após a data prevista)
- demands.overdueDetails: Lista de demandas VENCIDAS que ainda não foram entregues
- members[].onTimeCount e lateCount: Performance individual de pontualidade

DADOS COMPLETOS:
${JSON.stringify(analytics, null, 2)}

Por favor, gere o relatório de análise completo seguindo a estrutura definida, citando nomes e números exatos.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;
    
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente mais tarde." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos à sua conta." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao gerar análise" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return analytics data as first event, then stream AI response
    const analyticsEvent = `data: ${JSON.stringify({ type: "analytics", data: analytics })}\n\n`;
    
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();
    const geminiDecoder = new TextDecoder();

    // Write analytics first
    writer.write(encoder.encode(analyticsEvent));

    // Transform Gemini SSE stream to OpenAI-compatible format
    const reader = response.body!.getReader();
    
    (async () => {
      try {
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += geminiDecoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);

            if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
            const jsonStr = line.slice(6);
            try {
              const geminiData = JSON.parse(jsonStr);
              const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                // Convert to OpenAI-compatible format
                const openAIChunk = {
                  choices: [{ delta: { content: text } }],
                };
                await writer.write(encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
              }
            } catch {
              // partial JSON, put back
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } finally {
        writer.close();
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("board-summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function getWeekLabel(date: Date): string {
  const year = date.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
  return `${year}-S${week.toString().padStart(2, "0")}`;
}
