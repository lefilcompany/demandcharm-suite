// Ferramentas do assistente do quadro.
// Todas as leituras passam pelo client autenticado do usuário (RLS preservada) e
// pelas funções canônicas do banco: get_board_metrics e board_demand_facts.
import { tool } from "npm:ai@7.0.109";
import { z } from "npm:zod@3.25.76";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type ToolDeps = {
  supabase: SupabaseClient;
  boardId: string;
  tz: string;
};

const LIST_DEFAULT_LIMIT = 20;
const LIST_MAX_LIMIT = 50;

const DEMAND_FILTERS = [
  "all",
  "open",
  "overdue",
  "due_soon",
  "due_today",
  "no_due_date",
  "unassigned",
  "delivered",
  "delivered_late",
  "delivered_on_time",
  "backlog",
  "in_adjustment",
  "in_requests_stage",
  "subdemands_open",
  "rescheduled",
  "high_priority_open",
] as const;

type DemandFilter = (typeof DEMAND_FILTERS)[number];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && ISO_DATE.test(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function clampLimit(limit: unknown): number {
  const n = typeof limit === "number" && Number.isFinite(limit) ? Math.floor(limit) : LIST_DEFAULT_LIMIT;
  return Math.min(Math.max(n, 1), LIST_MAX_LIMIT);
}

function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (m) => `\\${m}`).replace(/[,()]/g, " ").trim();
}

function errorResult(message: string, details?: unknown) {
  return { error: message, details: typeof details === "string" ? details.slice(0, 300) : undefined };
}

type FactRow = {
  id: string;
  board_sequence_number: number | null;
  code: string | null;
  title: string;
  priority: string | null;
  stage_name: string | null;
  is_delivered: boolean;
  delivered_estimated: boolean;
  delivered_on: string | null;
  delivery_state: string;
  due_on: string | null;
  is_overdue_now: boolean;
  days_overdue: number | null;
  days_late: number | null;
  due_in_days: number | null;
  created_on: string | null;
  delivery_days: number | null;
  age_days: number | null;
  responsible_name: string | null;
  follower_names: string[] | null;
  service_name: string | null;
  created_by_name: string | null;
  is_subdemand: boolean;
  reschedule_count: number | null;
  time_seconds: number | null;
  effort_points: number | null;
};

const FACT_COLUMNS =
  "id,board_sequence_number,code,title,priority,stage_name,is_delivered,delivered_estimated,delivered_on,delivery_state,due_on,is_overdue_now,days_overdue,days_late,due_in_days,created_on,delivery_days,age_days,responsible_name,follower_names,service_name,created_by_name,is_subdemand,reschedule_count,time_seconds,effort_points";

function compactFact(r: FactRow) {
  const timeHours = r.time_seconds ? Math.round((r.time_seconds / 3600) * 10) / 10 : 0;
  return {
    id: r.id,
    code: r.code ?? (r.board_sequence_number != null ? `#${r.board_sequence_number}` : null),
    title: r.title,
    stage: r.stage_name,
    priority: r.priority,
    responsible: r.responsible_name ?? null,
    followers: r.follower_names?.length ? r.follower_names : undefined,
    service: r.service_name ?? null,
    created_on: r.created_on,
    due_on: r.due_on,
    status: r.is_delivered
      ? r.delivery_state === "delivered_late"
        ? "entregue_com_atraso"
        : r.delivery_state === "delivered_on_time"
          ? "entregue_no_prazo"
          : "entregue_sem_prazo"
      : r.is_overdue_now
        ? "vencida"
        : "aberta",
    days_overdue: r.is_overdue_now ? r.days_overdue : undefined,
    due_in_days: !r.is_delivered && !r.is_overdue_now && r.due_in_days != null ? r.due_in_days : undefined,
    delivered_on: r.delivered_on ?? undefined,
    delivered_date_estimated: r.is_delivered && r.delivered_estimated ? true : undefined,
    days_late: r.delivery_state === "delivered_late" ? r.days_late : undefined,
    delivery_days: r.is_delivered ? r.delivery_days : undefined,
    age_days: !r.is_delivered ? r.age_days : undefined,
    is_subdemand: r.is_subdemand || undefined,
    reschedules: r.reschedule_count || undefined,
    time_hours: timeHours || undefined,
    effort_points: r.effort_points ?? undefined,
  };
}

export function buildBoardTools({ supabase, boardId, tz }: ToolDeps) {
  const getBoardMetrics = tool({
    description:
      "Métricas consolidadas do quadro calculadas pela fonte oficial do banco. Retorna: estado ATUAL (abertas, entregues no total, vencidas, vencendo em 7 dias, hoje, sem prazo, sem responsável, backlog, em ajuste, na etapa Solicitações, subdemandas abertas, alta prioridade, médias de atraso, distribuição por etapa/prioridade/serviço/responsável), FLUXO DO PERÍODO (criadas, entregues, entregues no prazo x com atraso, taxa de pontualidade, tempo médio de entrega, solicitações por status, horas registradas) e LIMITE MENSAL. Use SEMPRE esta ferramenta para números; nunca estime. Sem período = histórico completo. Para restringir a um membro, informe member_id (obtenha em get_board_members).",
    inputSchema: z.object({
      from: z.string().nullish().describe("Início do período no formato AAAA-MM-DD, ou null para não filtrar."),
      to: z.string().nullish().describe("Fim do período no formato AAAA-MM-DD, ou null para não filtrar."),
      member_id: z.string().nullish().describe("UUID do membro para restringir as métricas a um responsável, ou null para o quadro inteiro."),
    }),
    execute: async ({ from, to, member_id }) => {
      if (from && !isIsoDate(from)) return errorResult("Parâmetro 'from' inválido: use AAAA-MM-DD.");
      if (to && !isIsoDate(to)) return errorResult("Parâmetro 'to' inválido: use AAAA-MM-DD.");
      if (member_id && !isUuid(member_id)) return errorResult("Parâmetro 'member_id' inválido: informe o UUID do membro.");

      const { data, error } = await supabase.rpc("get_board_metrics", {
        p_board_id: boardId,
        p_from: from ?? undefined,
        p_to: to ?? undefined,
        p_member_id: member_id ?? undefined,
        p_tz: tz,
      });
      if (error) return errorResult("Não foi possível calcular as métricas do quadro.", error.message);
      return data;
    },
  });

  const listDemands = tool({
    description:
      "Lista demandas do quadro com filtros. Use para responder QUAIS demandas (títulos, códigos, responsáveis, prazos), não apenas quantas. Filtros: all, open, overdue (vencidas), due_soon (vencem em até 7 dias), due_today, no_due_date, unassigned, delivered, delivered_late, delivered_on_time, backlog, in_adjustment, in_requests_stage, subdemands_open, rescheduled, high_priority_open. Combine com responsible, service, priority, stage, query (texto no título/código) e período de criação ou entrega. Retorna no máximo 50 itens e o total que casa com o filtro.",
    inputSchema: z.object({
      filter: z.string().nullish().describe("Filtro principal (um dos listados na descrição). null = open."),
      responsible: z.string().nullish().describe("Parte do nome do responsável, ou null."),
      service: z.string().nullish().describe("Parte do nome do serviço, ou null."),
      priority: z.string().nullish().describe("Prioridade exata: urgente, alta, média ou baixa; ou null."),
      stage: z.string().nullish().describe("Parte do nome da etapa (ex.: Backlog, Em Ajuste, Entregue), ou null."),
      query: z.string().nullish().describe("Texto para buscar no título ou código da demanda, ou null."),
      created_from: z.string().nullish().describe("Criadas a partir de AAAA-MM-DD, ou null."),
      created_to: z.string().nullish().describe("Criadas até AAAA-MM-DD, ou null."),
      delivered_from: z.string().nullish().describe("Entregues a partir de AAAA-MM-DD, ou null."),
      delivered_to: z.string().nullish().describe("Entregues até AAAA-MM-DD, ou null."),
      due_from: z.string().nullish().describe("Com prazo a partir de AAAA-MM-DD, ou null."),
      due_to: z.string().nullish().describe("Com prazo até AAAA-MM-DD, ou null."),
      limit: z.number().nullish().describe("Quantidade de itens (padrão 20, máximo 50), ou null."),
    }),
    execute: async (input) => {
      const rawFilter = (input.filter ?? "open").trim().toLowerCase();
      if (!(DEMAND_FILTERS as readonly string[]).includes(rawFilter)) {
        return errorResult(`Filtro inválido: '${rawFilter}'. Use um destes: ${DEMAND_FILTERS.join(", ")}.`);
      }
      const filter = rawFilter as DemandFilter;
      for (const key of ["created_from", "created_to", "delivered_from", "delivered_to", "due_from", "due_to"] as const) {
        const v = input[key];
        if (v && !isIsoDate(v)) return errorResult(`Parâmetro '${key}' inválido: use AAAA-MM-DD.`);
      }
      const limit = clampLimit(input.limit);

      let q = supabase
        .rpc("board_demand_facts", { p_board_id: boardId, p_tz: tz }, { count: "exact" })
        .select(FACT_COLUMNS);

      switch (filter) {
        case "open":
          q = q.eq("is_delivered", false);
          break;
        case "overdue":
          q = q.eq("is_overdue_now", true);
          break;
        case "due_soon":
          q = q.eq("is_due_soon", true);
          break;
        case "due_today":
          q = q.eq("is_delivered", false).eq("due_in_days", 0);
          break;
        case "no_due_date":
          q = q.eq("is_delivered", false).eq("has_due", false);
          break;
        case "unassigned":
          q = q.eq("is_delivered", false).is("responsible_id", null);
          break;
        case "delivered":
          q = q.eq("is_delivered", true);
          break;
        case "delivered_late":
          q = q.eq("delivery_state", "delivered_late");
          break;
        case "delivered_on_time":
          q = q.eq("delivery_state", "delivered_on_time");
          break;
        case "backlog":
          q = q.eq("is_backlog", true);
          break;
        case "in_adjustment":
          q = q.eq("is_adjustment", true);
          break;
        case "in_requests_stage":
          q = q.eq("is_requests_stage", true);
          break;
        case "subdemands_open":
          q = q.eq("is_subdemand", true).eq("is_delivered", false);
          break;
        case "rescheduled":
          q = q.gt("reschedule_count", 0);
          break;
        case "high_priority_open":
          q = q.eq("is_delivered", false).in("priority", ["alta", "urgente"]);
          break;
        case "all":
        default:
          break;
      }

      if (input.responsible?.trim()) q = q.ilike("responsible_name", `%${escapeIlike(input.responsible)}%`);
      if (input.service?.trim()) q = q.ilike("service_name", `%${escapeIlike(input.service)}%`);
      if (input.priority?.trim()) q = q.eq("priority", input.priority.trim().toLowerCase());
      if (input.stage?.trim()) q = q.ilike("stage_name", `%${escapeIlike(input.stage)}%`);
      if (input.query?.trim()) {
        const term = escapeIlike(input.query);
        q = q.or(`title.ilike.%${term}%,code.ilike.%${term}%`);
      }
      if (input.created_from) q = q.gte("created_on", input.created_from);
      if (input.created_to) q = q.lte("created_on", input.created_to);
      if (input.delivered_from) q = q.gte("delivered_on", input.delivered_from);
      if (input.delivered_to) q = q.lte("delivered_on", input.delivered_to);
      if (input.due_from) q = q.gte("due_on", input.due_from);
      if (input.due_to) q = q.lte("due_on", input.due_to);

      if (filter === "overdue") q = q.order("days_overdue", { ascending: false, nullsFirst: false });
      else if (filter === "due_soon" || filter === "due_today") q = q.order("due_on", { ascending: true, nullsFirst: false });
      else if (filter === "delivered_late") q = q.order("days_late", { ascending: false, nullsFirst: false });
      else if (filter === "delivered" || filter === "delivered_on_time")
        q = q.order("delivered_on", { ascending: false, nullsFirst: false });
      else q = q.order("created_at", { ascending: false });

      const { data, error, count } = await q.limit(limit);
      if (error) return errorResult("Não foi possível listar as demandas.", error.message);

      const rows = ((data ?? []) as unknown as FactRow[]).map(compactFact);
      return {
        filter,
        total_matching: count ?? rows.length,
        returned: rows.length,
        truncated: (count ?? rows.length) > rows.length,
        demands: rows,
      };
    },
  });

  const getBoardMembers = tool({
    description:
      "Lista os membros do quadro com papel (Administrador, Coordenador, Agente, Solicitante) e user_id. Use para descobrir o member_id de uma pessoa antes de chamar get_board_metrics com escopo por membro, ou para responder quem faz parte do quadro.",
    inputSchema: z.object({}),
    execute: async () => {
      const { data: members, error } = await supabase
        .from("board_members")
        .select("user_id, role, joined_at")
        .eq("board_id", boardId);
      if (error) return errorResult("Não foi possível listar os membros do quadro.", error.message);
      const ids = (members ?? []).map((m) => m.user_id);
      if (ids.length === 0) return { total: 0, members: [] };

      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      if (profErr) return errorResult("Não foi possível carregar os perfis dos membros.", profErr.message);

      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      const roleLabel: Record<string, string> = {
        admin: "Administrador",
        moderator: "Coordenador",
        executor: "Agente",
        requester: "Solicitante",
      };
      const order: Record<string, number> = { admin: 0, moderator: 1, executor: 2, requester: 3 };
      const list = (members ?? [])
        .map((m) => ({
          user_id: m.user_id,
          name: byId.get(m.user_id)?.full_name ?? "Membro",
          email: byId.get(m.user_id)?.email ?? undefined,
          role: roleLabel[m.role] ?? m.role,
          role_key: m.role,
          joined_at: m.joined_at?.slice(0, 10),
        }))
        .sort((a, b) => (order[a.role_key] ?? 9) - (order[b.role_key] ?? 9) || a.name.localeCompare(b.name, "pt-BR"));
      return { total: list.length, members: list };
    },
  });

  const listDemandRequests = tool({
    description:
      "Lista as solicitações de demanda do quadro (pedidos feitos por solicitantes que ainda precisam de aprovação ou já foram aprovados/devolvidos/recusados). Status: pending (aguardando aprovação), approved, returned (devolvida para ajustes), rejected. Use para responder o que está aguardando aprovação ou quais solicitações foram feitas em um período.",
    inputSchema: z.object({
      status: z.string().nullish().describe("pending, approved, returned, rejected ou all. null = pending."),
      created_from: z.string().nullish().describe("Criadas a partir de AAAA-MM-DD, ou null."),
      created_to: z.string().nullish().describe("Criadas até AAAA-MM-DD, ou null."),
      limit: z.number().nullish().describe("Quantidade de itens (padrão 20, máximo 50), ou null."),
    }),
    execute: async ({ status, created_from, created_to, limit }) => {
      const st = (status ?? "pending").trim().toLowerCase();
      if (!["pending", "approved", "returned", "rejected", "all"].includes(st)) {
        return errorResult("Status inválido. Use pending, approved, returned, rejected ou all.");
      }
      if (created_from && !isIsoDate(created_from)) return errorResult("Parâmetro 'created_from' inválido: use AAAA-MM-DD.");
      if (created_to && !isIsoDate(created_to)) return errorResult("Parâmetro 'created_to' inválido: use AAAA-MM-DD.");

      let q = supabase
        .from("demand_requests")
        .select("id, title, status, priority, created_at, responded_at, created_by, service_id, rejection_reason", { count: "exact" })
        .eq("board_id", boardId)
        .order("created_at", { ascending: false });
      if (st !== "all") q = q.eq("status", st);
      if (created_from) q = q.gte("created_at", `${created_from}T00:00:00`);
      if (created_to) q = q.lte("created_at", `${created_to}T23:59:59.999`);

      const { data, error, count } = await q.limit(clampLimit(limit));
      if (error) return errorResult("Não foi possível listar as solicitações.", error.message);

      const rows = data ?? [];
      const requesterIds = [...new Set(rows.map((r) => r.created_by).filter(Boolean))];
      const serviceIds = [...new Set(rows.map((r) => r.service_id).filter((v): v is string => !!v))];
      const [profilesRes, servicesRes] = await Promise.all([
        requesterIds.length
          ? supabase.from("profiles").select("id, full_name").in("id", requesterIds)
          : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
        serviceIds.length
          ? supabase.from("services").select("id, name").in("id", serviceIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      ]);
      const names = new Map((profilesRes.data ?? []).map((p) => [p.id, p.full_name]));
      const services = new Map((servicesRes.data ?? []).map((s) => [s.id, s.name]));
      const statusLabel: Record<string, string> = {
        pending: "aguardando aprovação",
        approved: "aprovada",
        returned: "devolvida para ajustes",
        rejected: "recusada",
      };

      return {
        status: st,
        total_matching: count ?? rows.length,
        returned: rows.length,
        requests: rows.map((r) => ({
          id: r.id,
          title: r.title,
          status: statusLabel[r.status] ?? r.status,
          priority: r.priority ?? undefined,
          requester: names.get(r.created_by) ?? "Solicitante",
          service: r.service_id ? services.get(r.service_id) ?? undefined : undefined,
          created_on: r.created_at?.slice(0, 10),
          responded_on: r.responded_at?.slice(0, 10) ?? undefined,
          rejection_reason: r.rejection_reason ?? undefined,
        })),
      };
    },
  });

  return {
    get_board_metrics: getBoardMetrics,
    list_demands: listDemands,
    get_board_members: getBoardMembers,
    list_demand_requests: listDemandRequests,
  };
}
