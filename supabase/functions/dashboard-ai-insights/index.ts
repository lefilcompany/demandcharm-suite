import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_INSIGHTS = [
  { title: "Acompanhe seus prazos", description: "Verifique regularmente suas demandas com prazo próximo para evitar atrasos.", type: "info" },
  { title: "Organize sua rotina", description: "Comece o dia priorizando as demandas mais críticas em que você é responsável.", type: "info" },
  { title: "Mantenha o ritmo", description: "Acompanhe também as demandas em que você é seguidor para apoiar a equipe.", type: "success" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    const { board_id } = await req.json();
    if (!board_id) {
      return new Response(JSON.stringify({ error: "board_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: caller must be a member of the requested board
    const { data: membership } = await supabase
      .from("board_members")
      .select("user_id, role")
      .eq("board_id", board_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cache lookup (24h TTL)
    const { data: cached } = await supabase
      .from("user_board_ai_insights")
      .select("insights, expires_at")
      .eq("user_id", userId)
      .eq("board_id", board_id)
      .maybeSingle();

    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      return new Response(JSON.stringify({ insights: cached.insights }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch board info
    const { data: boardData } = await supabase
      .from("boards")
      .select("name")
      .eq("id", board_id)
      .maybeSingle();
    const boardName = boardData?.name || "Quadro";

    // Fetch profile name
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const userName = profileData?.full_name || "Usuário";

    // Demands where the user is assignee (primary or follower)
    const { data: assigneeRows } = await supabase
      .from("demand_assignees")
      .select("demand_id, is_primary")
      .eq("user_id", userId);

    const assigneeMap = new Map<string, boolean>();
    for (const row of assigneeRows || []) {
      // primary wins
      const existing = assigneeMap.get(row.demand_id);
      assigneeMap.set(row.demand_id, existing === true ? true : !!row.is_primary);
    }

    // Also include legacy assigned_to and created_by, but only treat them as fallback if not in assignees
    const { data: legacyDemands } = await supabase
      .from("demands")
      .select("id, assigned_to, created_by")
      .eq("board_id", board_id)
      .eq("archived", false)
      .or(`assigned_to.eq.${userId},created_by.eq.${userId}`);

    for (const d of legacyDemands || []) {
      if (!assigneeMap.has(d.id)) {
        // Treat assigned_to as primary, created_by as follower
        assigneeMap.set(d.id, d.assigned_to === userId);
      }
    }

    const demandIds = Array.from(assigneeMap.keys());

    let demands: any[] = [];
    if (demandIds.length > 0) {
      const { data: demandsData } = await supabase
        .from("demands")
        .select("id, title, due_date, delivered_at, is_overdue, status_id, demand_statuses(name), services(name)")
        .eq("board_id", board_id)
        .eq("archived", false)
        .in("id", demandIds)
        .limit(500);
      demands = demandsData || [];
    }

    // Aggregate metrics
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in3Days = new Date(today);
    in3Days.setDate(in3Days.getDate() + 3);
    const last30 = new Date(today);
    last30.setDate(last30.getDate() - 30);

    let asResponsibleTotal = 0;
    let asFollowerTotal = 0;
    let overdueResponsible = 0;
    let overdueFollower = 0;
    let dueTodayResponsible = 0;
    let dueTodayFollower = 0;
    let dueSoonResponsible = 0;
    let dueSoonFollower = 0;
    let deliveredOnTime30d = 0;
    let deliveredLate30d = 0;
    let inAdjustment = 0;
    let awaitingApproval = 0;
    const statusCounts: Record<string, number> = {};
    const serviceCounts: Record<string, number> = {};
    const critical: { title: string; reason: string }[] = [];

    for (const d of demands) {
      const isPrimary = assigneeMap.get(d.id) === true;
      const statusName: string = d.demand_statuses?.name || "Sem status";
      const serviceName: string = d.services?.name || "Sem serviço";
      const delivered = !!d.delivered_at || statusName === "Entregue";

      statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;
      serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1;

      if (isPrimary) asResponsibleTotal++; else asFollowerTotal++;

      if (statusName === "Em Ajuste") inAdjustment++;
      if (statusName === "Aprovação Interna") awaitingApproval++;

      if (delivered) {
        const deliveredAt = d.delivered_at ? new Date(d.delivered_at) : null;
        if (deliveredAt && deliveredAt >= last30) {
          if (d.is_overdue === true) deliveredLate30d++;
          else deliveredOnTime30d++;
        }
        continue;
      }

      if (!d.due_date) continue;
      const due = new Date(d.due_date);
      const isOverdue = d.is_overdue === true || due < now;
      const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

      if (isOverdue) {
        if (isPrimary) overdueResponsible++; else overdueFollower++;
        if (critical.length < 5) critical.push({ title: d.title, reason: `atrasada (venceu em ${due.toISOString().slice(0, 10)})` });
      } else if (dueDay.getTime() === today.getTime()) {
        if (isPrimary) dueTodayResponsible++; else dueTodayFollower++;
        if (critical.length < 5) critical.push({ title: d.title, reason: "vence hoje" });
      } else if (dueDay > today && dueDay <= in3Days) {
        if (isPrimary) dueSoonResponsible++; else dueSoonFollower++;
        if (critical.length < 5) critical.push({ title: d.title, reason: `vence em ${d.due_date.slice(0, 10)}` });
      }
    }

    const roleLabel = (() => {
      switch (membership.role) {
        case "admin": return "Administrador";
        case "moderator": return "Coordenador";
        case "executor": return "Executor";
        case "requester": return "Solicitante";
        default: return "Membro";
      }
    })();

    const summaryText = `Quadro: ${boardName}
Usuário: ${userName} (papel: ${roleLabel})
Data da análise: ${today.toISOString().slice(0, 10)}

Total de demandas em que está envolvido: ${demands.length}
  - Como responsável: ${asResponsibleTotal}
  - Como acompanhante (seguidor): ${asFollowerTotal}

Atrasadas (não entregues):
  - Como responsável: ${overdueResponsible}
  - Como acompanhante: ${overdueFollower}

Vencem hoje:
  - Como responsável: ${dueTodayResponsible}
  - Como acompanhante: ${dueTodayFollower}

Vencem nos próximos 3 dias:
  - Como responsável: ${dueSoonResponsible}
  - Como acompanhante: ${dueSoonFollower}

Em ajuste: ${inAdjustment}
Aguardando aprovação interna: ${awaitingApproval}

Últimos 30 dias:
  - Entregues no prazo: ${deliveredOnTime30d}
  - Entregues com atraso: ${deliveredLate30d}

Distribuição por status: ${Object.entries(statusCounts).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"}
Distribuição por serviço: ${Object.entries(serviceCounts).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"}

Demandas mais críticas (até 5):
${critical.length > 0 ? critical.map((c, i) => `${i + 1}. "${c.title}" — ${c.reason}`).join("\n") : "Nenhuma demanda crítica identificada."}`;

    const systemPrompt = `Você é um assistente pessoal de produtividade. Gere exatamente 3 insights curtos, acionáveis e PERSONALIZADOS para o usuário com base apenas nas demandas em que ele está envolvido neste quadro (como responsável ou acompanhante).
Responda APENAS com um JSON com a chave "insights" contendo um array de 3 objetos.
Cada objeto deve ter: "title" (máx 6 palavras), "description" (máx 2 frases curtas, fale em segunda pessoa — "Você tem...", "Priorize..."), "type" (um de: "warning", "success", "info").
Priorize: demandas ATRASADAS, demandas que VENCEM HOJE e demandas que vencem nos próximos 3 dias.
Diferencie demandas em que o usuário é responsável (ação direta) das que ele é acompanhante (apoiar/acompanhar).
Se não há demandas atribuídas, gere insights informativos e amigáveis.
Não invente dados que não estão no resumo.`;

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const aiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\nDados:\n${summaryText}` }] },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 2048,
          responseSchema: {
            type: "OBJECT",
            properties: {
              insights: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING" },
                    description: { type: "STRING" },
                    type: { type: "STRING", enum: ["warning", "success", "info"] },
                  },
                  required: ["title", "description", "type"],
                },
              },
            },
            required: ["insights"],
          },
        },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const text = await aiResponse.text().catch(() => "");
      console.error("Gemini AI error:", status, text);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let insights: any[] = [];

    try {
      const textContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textContent) {
        const parsed = JSON.parse(textContent);
        insights = Array.isArray(parsed.insights) ? parsed.insights : [];
      }
    } catch (e) {
      console.error("Failed to parse Gemini response:", e);
    }

    if (insights.length === 0) {
      insights = FALLBACK_INSIGHTS;
    }

    insights = insights.slice(0, 3);

    // Persist with 24h TTL
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error: upsertError } = await supabase
      .from("user_board_ai_insights")
      .upsert(
        {
          user_id: userId,
          board_id,
          insights,
          generated_at: new Date().toISOString(),
          expires_at: expiresAt,
        },
        { onConflict: "user_id,board_id" }
      );

    if (upsertError) {
      console.error("Failed to persist insights:", upsertError);
    }

    return new Response(JSON.stringify({ insights }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
