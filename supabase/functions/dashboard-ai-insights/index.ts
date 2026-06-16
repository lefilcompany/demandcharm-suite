import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const { board_id, is_requester } = await req.json();
    if (!board_id) {
      return new Response(JSON.stringify({ error: "board_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: caller must be a member of the requested board
    const { data: membership } = await supabase
      .from("board_members")
      .select("user_id")
      .eq("board_id", board_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const demandsQuery = supabase
      .from("demands")
      .select(
        "id, due_date, delivered_at, is_overdue, created_by, demand_statuses(name), services(name)"
      )
      .eq("board_id", board_id)
      .limit(100);

    if (is_requester) {
      demandsQuery.eq("created_by", userId);
    }

    const [demandsRes, membersRes, boardRes, requestsRes] = await Promise.all([
      demandsQuery,
      supabase
        .from("board_members")
        .select("user_id, role")
        .eq("board_id", board_id),
      supabase
        .from("boards")
        .select("name, team_id")
        .eq("id", board_id)
        .single(),
      is_requester
        ? supabase
            .from("demand_requests")
            .select("id, status, created_at, title")
            .eq("created_by", userId)
            .eq("board_id", board_id)
            .order("created_at", { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
    ]);

    const demands = demandsRes.data || [];
    const members = membersRes.data || [];
    const boardName = boardRes.data?.name || "Quadro";
    const requests = requestsRes.data || [];

    // Calculate summary stats
    const statusCounts: Record<string, number> = {};
    const serviceCounts: Record<string, number> = {};
    let overdueCount = 0;            // não entregues e atrasadas
    let deliveredCount = 0;          // total entregues (no prazo + com atraso)
    let deliveredOnTimeCount = 0;    // entregues no prazo
    let deliveredLateCount = 0;      // entregues com atraso
    const now = new Date();

    for (const d of demands) {
      const statusName = (d as any).demand_statuses?.name || "Sem status";
      const serviceName = (d as any).services?.name || "Sem serviço";
      const isOverdueFlag = (d as any).is_overdue === true;
      statusCounts[statusName] = (statusCounts[statusName] || 0) + 1;
      serviceCounts[serviceName] = (serviceCounts[serviceName] || 0) + 1;

      const isDelivered = !!d.delivered_at || statusName === "Entregue";

      if (isDelivered) {
        deliveredCount++;
        if (isOverdueFlag) deliveredLateCount++;
        else deliveredOnTimeCount++;
      } else {
        // Não entregue: vencida se is_overdue=true (ou data passada como fallback)
        if (isOverdueFlag || (d.due_date && new Date(d.due_date) < now)) {
          overdueCount++;
        }
      }
    }

    const totalMembers = members.length;
    const totalDemands = demands.length;

    let summaryText: string;

    if (is_requester) {
      const requestStatusCounts: Record<string, number> = {};
      for (const r of requests as any[]) {
        requestStatusCounts[r.status] = (requestStatusCounts[r.status] || 0) + 1;
      }

      summaryText = `Quadro: ${boardName}
Visão do Cliente/Solicitante:
Total de demandas solicitadas: ${totalDemands}
Demandas entregues no prazo: ${deliveredOnTimeCount}
Demandas entregues com atraso: ${deliveredLateCount}
Demandas vencidas (ainda não entregues): ${overdueCount}
Status das demandas: ${Object.entries(statusCounts).map(([k, v]) => `${k}: ${v}`).join(", ")}
Serviços solicitados: ${Object.entries(serviceCounts).map(([k, v]) => `${k}: ${v}`).join(", ")}
Solicitações recentes: ${(requests as any[]).length} (${Object.entries(requestStatusCounts).map(([k, v]) => `${k}: ${v}`).join(", ")})`;
    } else {
      summaryText = `Quadro: ${boardName}
Total de demandas: ${totalDemands}
Membros: ${totalMembers}
Entregues no prazo: ${deliveredOnTimeCount}
Entregues com atraso: ${deliveredLateCount}
Vencidas (não entregues): ${overdueCount}
Status: ${Object.entries(statusCounts).map(([k, v]) => `${k}: ${v}`).join(", ")}

IMPORTANTE: diferencie nos insights "entregues no prazo", "entregues com atraso" e "vencidas (ainda não entregues)". Não some essas categorias como se fossem a mesma coisa.`;
    }

    // Call Google Gemini AI
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = is_requester
      ? `Você é um assistente de acompanhamento de serviços para clientes/solicitantes. Gere exatamente 3 insights curtos e úteis baseados nos dados das demandas do cliente.
Responda APENAS com um JSON array de 3 objetos, sem markdown, sem code blocks.
Cada objeto deve ter: "title" (máx 6 palavras), "description" (máx 2 frases curtas), "type" (um de: "warning", "success", "info").
Foque em: status das entregas, prazos, serviços mais solicitados, e andamento geral das solicitações do cliente.
Use linguagem amigável e voltada para o cliente. Não mencione membros internos da equipe.
Se não houver dados suficientes, crie insights sobre como acompanhar melhor as solicitações.`
      : `Você é um analista de produtividade. Gere exatamente 3 insights curtos e acionáveis baseados nos dados do quadro.
Responda APENAS com um JSON array de 3 objetos, sem markdown, sem code blocks.
Cada objeto deve ter: "title" (máx 6 palavras), "description" (máx 2 frases curtas), "type" (um de: "warning", "success", "info").
Foque em: prazos, gargalos, produtividade e distribuição de carga.
Se não houver dados suficientes, crie insights genéricos sobre boas práticas de gestão.`;

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
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("Gemini AI error:", status, await aiResponse.text());
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    let insights = [];

    try {
      const textContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (textContent) {
        const parsed = JSON.parse(textContent);
        insights = parsed.insights || [];
      }
    } catch (e) {
      console.error("Failed to parse Gemini response:", e);
      insights = [
        { title: "Acompanhe os prazos", description: "Verifique regularmente as demandas com prazo próximo para evitar atrasos.", type: "info" },
        { title: "Distribua a carga", description: "Equilibre as demandas entre os membros da equipe para maior produtividade.", type: "info" },
        { title: "Revise entregas", description: "Analise as demandas entregues para identificar padrões de melhoria.", type: "success" },
      ];
    }

    return new Response(JSON.stringify({ insights: insights.slice(0, 3) }), {
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
