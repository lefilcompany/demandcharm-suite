// Assistente do quadro: responde perguntas sobre um quadro usando tool calling
// sobre as métricas canônicas do banco (get_board_metrics / board_demand_facts).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "npm:ai@7.0.109";
import { createGoogleGenerativeAI } from "npm:@ai-sdk/google@4.0.78";
import { z } from "npm:zod@3.25.76";
import { buildBoardTools } from "./tools.ts";
import { buildSystemPrompt } from "./prompt.ts";
import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "./gateway.ts";

const DEFAULT_TZ = "America/Fortaleza";
const MODEL_ID = "gemini-2.5-flash";
const MAX_HISTORY_MESSAGES = 30;
const MAX_TEXT_CHARS = 8000;

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const PartSchema = z.object({ type: z.string() }).passthrough();
const MessageSchema = z
  .object({
    id: z.string().optional(),
    role: z.enum(["user", "assistant", "system"]),
    parts: z.array(PartSchema),
  })
  .passthrough();

const BodySchema = z.object({
  boardId: z.string().uuid(),
  messages: z.array(MessageSchema).min(1),
  timezone: z.string().optional(),
});

function resolveTimeZone(tz: string | undefined): string {
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

function todayIn(tz: string): string {
  // en-CA produz AAAA-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  moderator: "Coordenador",
  executor: "Agente",
  requester: "Solicitante",
};

type GatewayErrorLike = {
  statusCode?: number;
  responseBody?: string;
  message?: string;
  name?: string;
};

// Converte falhas do gateway/modelo em mensagens legíveis para o usuário.
function friendlyError(error: unknown): string {
  const e = (error ?? {}) as GatewayErrorLike;
  const body = typeof e.responseBody === "string" ? e.responseBody : "";
  const status = e.statusCode;

  if (status === 403 && body.includes("credit_limit_reached")) {
    return "O limite de créditos de IA do workspace foi atingido. Peça ao administrador do workspace para ajustar o limite e tente novamente.";
  }
  if (status === 402) {
    return "Os créditos de IA acabaram. Adicione créditos ao workspace para continuar usando o assistente.";
  }
  if (status === 429) {
    return "Muitas perguntas em sequência. Aguarde alguns segundos e tente novamente.";
  }
  if (status && status >= 500) {
    return "O serviço de IA está instável no momento. Tente novamente em instantes.";
  }
  if (e.name === "AbortError") {
    return "A resposta foi interrompida.";
  }
  console.error("board-agent stream error:", e.name, e.message, status, body.slice(0, 300));
  return "Não consegui concluir a resposta agora. Tente novamente.";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);
    const token = authHeader.slice("Bearer ".length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      console.error("GEMINI_API_KEY não configurada");
      return json({ error: "O assistente não está configurado neste ambiente." }, 500);
    }

    // Client com o JWT do usuário: RLS e as guardas SECURITY DEFINER usam auth.uid().
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return json({ error: "Sessão inválida. Entre novamente." }, 401);

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return json({ error: "Corpo da requisição inválido." }, 400);
    }
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return json({ error: "Parâmetros inválidos.", details: parsed.error.flatten().fieldErrors }, 400);
    }
    const { boardId } = parsed.data;
    const tz = resolveTimeZone(parsed.data.timezone);

    // Acesso ao quadro (RLS): sem linha = sem acesso.
    const [{ data: board, error: boardError }, { data: membership }, { data: profile }] = await Promise.all([
      supabase.from("boards").select("id, name, description").eq("id", boardId).maybeSingle(),
      supabase.from("board_members").select("role").eq("board_id", boardId).eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    ]);
    if (boardError) {
      console.error("Erro ao carregar quadro:", boardError.message);
      return json({ error: "Erro ao verificar o quadro." }, 500);
    }
    if (!board) return json({ error: "Você não tem acesso a este quadro." }, 403);

    // Histórico limitado e sanitizado: só texto do usuário e as partes do assistente.
    const history = parsed.data.messages.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
      ...m,
      id: m.id ?? crypto.randomUUID(),
      parts: m.parts
        .filter((p) => (m.role === "user" ? p.type === "text" : true))
        .map((p) =>
          p.type === "text" && typeof (p as { text?: unknown }).text === "string"
            ? { ...p, text: ((p as unknown as { text: string }).text).slice(0, MAX_TEXT_CHARS) }
            : p,
        ),
    })) as UIMessage[];

    let modelMessages;
    try {
      modelMessages = await convertToModelMessages(history, { ignoreIncompleteToolCalls: true });
    } catch (e) {
      console.error("Falha ao converter mensagens:", e);
      return json({ error: "Histórico de conversa inválido. Inicie uma nova conversa." }, 400);
    }

    const today = todayIn(tz);
    const system = buildSystemPrompt({
      boardName: board.name,
      boardDescription: board.description,
      userId: user.id,
      userName: profile?.full_name ?? user.email ?? "Usuário",
      userRole: membership?.role ? ROLE_LABEL[membership.role] ?? membership.role : "Membro da equipe",
      today,
      tz,
      monthStart: `${today.slice(0, 7)}-01`,
    });

    // Provider criado dentro da requisição: o wrapper de fetch guarda o run id por chamada.
    const initialRunId = getLovableAiGatewayRunId(req);
    const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
    const google = createGoogleGenerativeAI({
      apiKey: geminiApiKey,
      fetch: runIdFetch.fetch,
    });

    const result = streamText({
      model: google(MODEL_ID),
      system,
      messages: modelMessages,
      tools: buildBoardTools({ supabase, boardId, tz }),
      stopWhen: isStepCount(50),
      abortSignal: req.signal,
      providerOptions: {
        google: {
          // Raciocínio interno sem exposição ao usuário (evita texto técnico em inglês no chat).
          thinkingConfig: { includeThoughts: false, thinkingBudget: 2048 },
        },
      },
      onError: ({ error }) => {
        const e = error as GatewayErrorLike;
        console.error("board-agent model error:", e?.name, e?.message, e?.statusCode);
      },
    });

    const uiStream = toUIMessageStream({
      stream: result.stream,
      originalMessages: history,
      sendReasoning: false,
      onError: friendlyError,
    });

    // Mantém os headers do stream (SSE) e acrescenta CORS + run id do gateway.
    const base = createUIMessageStreamResponse({ stream: uiStream });
    const headers = getLovableAiGatewayResponseHeaders(base.headers, {
      ...corsHeaders,
      ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
    });
    base.headers.forEach((value, name) => {
      if (!headers.has(name)) headers.set(name, value);
    });
    const response = new Response(base.body, { status: base.status, statusText: base.statusText, headers });

    return await withLovableAiGatewayRunIdHeader(response, runIdFetch, corsHeaders);
  } catch (error) {
    console.error("board-agent fatal error:", error);
    return json({ error: "Erro interno do assistente." }, 500);
  }
});
