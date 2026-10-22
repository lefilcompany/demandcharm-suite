import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Não autorizado" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await supabase.auth.getUser(auth.slice(7));
    if (!user) return json({ error: "Sessão inválida" }, 401);

    const body = await req.json().catch(() => ({}));
    const sprintId = body?.sprintId;
    if (typeof sprintId !== "string" || !UUID.test(sprintId)) return json({ error: "sprintId inválido" }, 400);

    // RLS garante que só membros do quadro enxergam a sprint e as demandas.
    const { data: sprint } = await supabase.from("board_sprints").select("id, name, goal").eq("id", sprintId).maybeSingle();
    if (!sprint) return json({ error: "Sprint não encontrada" }, 404);

    const { data: rows, error } = await supabase
      .from("sprint_demands")
      .select("demands!inner(title, description, board_sequence_number, delivered_at, services(name))")
      .eq("sprint_id", sprintId)
      .not("demands.delivered_at", "is", null);
    if (error) throw error;
    const delivered = (rows ?? []).map((r: any) => r.demands).filter(Boolean);
    if (!delivered.length) return json({ groups: [] });

    const list = delivered.slice(0, 80).map((d: any) => ({
      code: d.board_sequence_number ? `#${String(d.board_sequence_number).padStart(4, "0")}` : "",
      service: d.services?.name ?? "Sem serviço",
      title: d.title,
      description: String(d.description ?? "").replace(/<[^>]+>/g, " ").slice(0, 600),
    }));

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) throw new Error("GEMINI_API_KEY ausente");
    const prompt = `Você escreve notas de versão de uma sprint (SoMA+). Sprint: ${sprint.name}. Objetivo: ${sprint.goal ?? "—"}.
A partir das demandas ENTREGUES abaixo, liste o que agora é possível fazer ou ver que antes da sprint não era.
Regras: português do Brasil; cada item começa com "Agora é possível" ou "Agora dá para ver"; uma frase curta e concreta; não invente nada que não esteja nas demandas; agrupe por serviço; cite os códigos das demandas de origem.
Responda só JSON: {"groups":[{"service":"...","items":[{"text":"...","codes":["#0001"]}]}]}
Demandas: ${JSON.stringify(list)}`;

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.3 },
      }),
    });
    if (!r.ok) {
      console.error("gemini", r.status, await r.text());
      return json({ error: "A IA não respondeu agora. Tente de novo." }, 502);
    }
    const out = await r.json();
    const text = out?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(text); } catch { parsed = {}; }
    const groups = Array.isArray(parsed.groups)
      ? parsed.groups
          .map((g: any) => ({
            service: String(g?.service ?? "Geral").slice(0, 120),
            items: (Array.isArray(g?.items) ? g.items : [])
              .map((i: any) => ({
                text: String(i?.text ?? "").slice(0, 400),
                codes: (Array.isArray(i?.codes) ? i.codes : []).map(String).slice(0, 10),
              }))
              .filter((i: any) => i.text),
          }))
          .filter((g: any) => g.items.length)
      : [];
    return json({ groups });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro ao gerar as novidades" }, 500);
  }
});
