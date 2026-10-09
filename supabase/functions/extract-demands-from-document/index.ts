import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const BodySchema = z.object({
  board_id: z.string().uuid(),
  file_name: z.string().max(400),
  text: z.string().max(400_000).nullish(),
  pdf_base64: z.string().max(15_000_000).nullish(),
});

const EFFORT = [1, 2, 3, 5, 8, 13, 21];
const snapEffort = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 3;
  return EFFORT.reduce((b, x) => (Math.abs(x - n) < Math.abs(b - n) ? x : b), 1);
};
const priorityFromCode = (c?: string | null) => {
  const u = (c ?? "").toUpperCase().trim();
  return u === "P0" ? "alta" : u === "P2" ? "baixa" : "média";
};

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado" }, 401);
    const url = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autenticado" }, 401);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Dados inválidos" }, 400);
    const { board_id, file_name, text, pdf_base64 } = parsed.data;
    if (!text && !pdf_base64) return json({ error: "Arquivo vazio" }, 400);

    const { data: membership } = await userClient
      .from("board_members").select("role").eq("board_id", board_id).eq("user_id", user.id).maybeSingle();
    if (!membership) return json({ error: "Você não tem acesso a este quadro" }, 403);

    const [{ data: services }, { data: members }] = await Promise.all([
      userClient.from("board_services").select("service:services(id, name)").eq("board_id", board_id),
      userClient.from("board_members").select("user_id").eq("board_id", board_id),
    ]);
    const serviceList = (services ?? []).map((s: any) => s.service).filter(Boolean) as { id: string; name: string }[];
    const ids = (members ?? []).map((m: any) => m.user_id);
    const { data: profiles } = ids.length
      ? await userClient.from("profiles").select("id, full_name").in("id", ids)
      : { data: [] as any[] };
    const people = (profiles ?? []) as { id: string; full_name: string }[];

    const key = Deno.env.get("GEMINI_API_KEY");
    if (!key) return json({ error: "IA não configurada" }, 500);

    const today = new Date().toISOString().substring(0, 10);
    const prompt = `Você extrai demandas (tarefas de trabalho) de documentos. Hoje é ${today}.
Leia o documento "${file_name}" e liste cada demanda descrita (no máximo 50).
Para cada uma: título curto e claro; descrição detalhada (mínimo 20 caracteres, use o conteúdo do documento);
serviço: escolha o nome EXATO de um destes, ou null: ${serviceList.map((s) => s.name).join(" | ") || "(nenhum)"};
prazo no formato AAAA-MM-DD se mencionado, senão null;
priority_code: o código de prioridade escrito no documento para a demanda (P0, P1 ou P2), ou null se não houver;
effort_points: estime o esforço na escala Fibonacci 1, 2, 3, 5, 8, 13 ou 21 (1–3 pouco, 5–8 médio, 13–21 alto) pelo tamanho, complexidade, dependências e incerteza descritos;
effort_reason: justificativa curta do esforço (até 80 caracteres, em português);
responsável: nome EXATO de uma destas pessoas se mencionado, senão null: ${people.map((p) => p.full_name).join(" | ") || "(nenhuma)"}.
Se o documento for uma planilha, cada linha costuma ser uma demanda.`;

    const parts: any[] = [{ text: prompt }];
    if (pdf_base64) parts.push({ inline_data: { mime_type: "application/pdf", data: pdf_base64 } });
    if (text) parts.push({ text: `DOCUMENTO:\n${text}` });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                demands: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      title: { type: "STRING" },
                      description: { type: "STRING" },
                      service: { type: "STRING", nullable: true },
                      due_date: { type: "STRING", nullable: true },
                      priority_code: { type: "STRING", enum: ["P0", "P1", "P2"], nullable: true },
                      effort_points: { type: "INTEGER" },
                      effort_reason: { type: "STRING" },
                      assignee: { type: "STRING", nullable: true },
                    },
                    required: ["title", "description", "effort_points"],
                  },
                },
              },
              required: ["demands"],
            },
          },
        }),
      },
    );
    if (!res.ok) {
      console.error("Gemini error", res.status, await res.text());
      return json({ error: res.status === 429 ? "Muitas solicitações à IA, tente em instantes" : "Falha ao analisar o documento" }, 502);
    }
    const out = await res.json();
    const raw = out?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") ?? "";
    let items: any[] = [];
    try { items = JSON.parse(raw).demands ?? []; } catch { items = []; }

    const demands = items.slice(0, 50).map((d) => {
      const svc = d.service ? serviceList.find((s) => norm(s.name) === norm(d.service)) : undefined;
      const person = d.assignee
        ? people.find((p) => norm(p.full_name) === norm(d.assignee)) ??
          people.find((p) => norm(p.full_name).includes(norm(d.assignee)))
        : undefined;
      const due = typeof d.due_date === "string" && /^\d{4}-\d{2}-\d{2}/.test(d.due_date) ? d.due_date.substring(0, 10) : null;
      return {
        title: String(d.title ?? "").slice(0, 500),
        description: String(d.description ?? ""),
        service_id: svc?.id ?? null,
        due_date: due,
        priority_code: ["P0", "P1", "P2"].includes(String(d.priority_code).toUpperCase()) ? String(d.priority_code).toUpperCase() : null,
        priority: priorityFromCode(d.priority_code),
        effort_points: snapEffort(d.effort_points),
        effort_reason: String(d.effort_reason ?? "").slice(0, 120),
        assigned_to: person?.id ?? null,
      };
    });
    return json({ demands });
  } catch (e) {
    console.error(e);
    return json({ error: "Erro inesperado" }, 500);
  }
});
