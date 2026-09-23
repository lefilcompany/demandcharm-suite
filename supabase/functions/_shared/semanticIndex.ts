// Monta e mantém o índice semântico de um quadro (tabela public.search_documents).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { embedDocuments } from "./geminiEmbeddings.ts";

export type SearchDoc = {
  entity_type: "demand" | "request" | "member" | "service";
  entity_id: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "aguardando aprovação",
  approved: "aprovada",
  rejected: "recusada",
  returned: "devolvida para ajuste",
  adjustment: "devolvida para ajuste",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador do quadro",
  moderator: "Coordenador",
  executor: "Agente",
  requester: "Solicitante",
};

function clean(value: unknown, max = 1200): string {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function demandStatusLabel(f: Record<string, any>): string {
  if (f.is_delivered) {
    if (f.delivery_state === "delivered_late") return "entregue com atraso";
    if (f.delivery_state === "delivered_on_time") return "entregue no prazo";
    return "entregue";
  }
  if (f.is_overdue_now) return "atrasada, vencida";
  return "aberta, em andamento";
}

export async function buildBoardDocs(
  admin: SupabaseClient,
  boardId: string,
  tz: string,
): Promise<SearchDoc[]> {
  const docs: SearchDoc[] = [];

  const [factsRes, demandsRes, requestsRes, membersRes, servicesRes] = await Promise.all([
    admin.rpc("board_demand_facts", { p_board_id: boardId, p_tz: tz }),
    admin.from("demands").select("id,description,archived").eq("board_id", boardId),
    admin
      .from("demand_requests")
      .select("id,title,description,status,priority,created_at,service_id,created_by,board_id")
      .eq("board_id", boardId),
    admin
      .from("board_members")
      .select("user_id,role,profiles:user_id(id,full_name,job_title)")
      .eq("board_id", boardId),
    admin
      .from("services")
      .select("id,name,description,is_folder,is_active,estimated_hours")
      .eq("board_id", boardId),
  ]);

  const descriptions = new Map<string, string>();
  for (const d of demandsRes.data ?? []) {
    if (!(d as any).archived) descriptions.set((d as any).id, clean((d as any).description));
  }

  const serviceNames = new Map<string, string>();
  for (const s of servicesRes.data ?? []) serviceNames.set((s as any).id, (s as any).name);

  const profileNames = new Map<string, string>();
  for (const m of membersRes.data ?? []) {
    const p = (m as any).profiles;
    if (p?.id) profileNames.set(p.id, p.full_name ?? "");
  }

  for (const raw of (factsRes.data ?? []) as Array<Record<string, any>>) {
    if (!descriptions.has(raw.id)) continue; // demanda arquivada ou fora do escopo
    const code = raw.code ?? (raw.board_sequence_number != null ? `#${raw.board_sequence_number}` : "");
    const parts = [
      `Demanda ${code}: ${raw.title}`,
      descriptions.get(raw.id) || "",
      `Situação: ${demandStatusLabel(raw)}.`,
      raw.stage_name ? `Etapa: ${raw.stage_name}.` : "",
      raw.priority ? `Prioridade: ${raw.priority}.` : "",
      raw.service_name ? `Serviço: ${raw.service_name}.` : "",
      raw.responsible_name ? `Responsável: ${raw.responsible_name}.` : "Sem responsável definido.",
      Array.isArray(raw.follower_names) && raw.follower_names.length
        ? `Seguidores: ${raw.follower_names.join(", ")}.`
        : "",
      raw.created_by_name ? `Criada por: ${raw.created_by_name}.` : "",
      raw.due_on ? `Prazo: ${raw.due_on}.` : "Sem prazo definido.",
      raw.is_overdue_now && raw.days_overdue ? `Atrasada há ${raw.days_overdue} dias.` : "",
      raw.delivered_on ? `Entregue em ${raw.delivered_on}.` : "",
      raw.is_subdemand ? "É uma subdemanda." : "",
    ].filter(Boolean);

    docs.push({
      entity_type: "demand",
      entity_id: raw.id,
      title: `${code ? `${code} · ` : ""}${raw.title}`,
      content: parts.join(" "),
      metadata: {
        code,
        stage: raw.stage_name ?? null,
        priority: raw.priority ?? null,
        responsible: raw.responsible_name ?? null,
        service: raw.service_name ?? null,
        due_on: raw.due_on ?? null,
        status: demandStatusLabel(raw),
      },
    });
  }

  for (const r of (requestsRes.data ?? []) as Array<Record<string, any>>) {
    const status = STATUS_LABEL[r.status] ?? r.status ?? "";
    const parts = [
      `Solicitação de demanda: ${r.title}.`,
      clean(r.description),
      status ? `Situação da solicitação: ${status}.` : "",
      r.priority ? `Prioridade: ${r.priority}.` : "",
      r.service_id && serviceNames.has(r.service_id) ? `Serviço: ${serviceNames.get(r.service_id)}.` : "",
      r.created_by && profileNames.has(r.created_by) ? `Solicitada por: ${profileNames.get(r.created_by)}.` : "",
      r.created_at ? `Criada em ${String(r.created_at).substring(0, 10)}.` : "",
    ].filter(Boolean);

    docs.push({
      entity_type: "request",
      entity_id: r.id,
      title: r.title,
      content: parts.join(" "),
      metadata: { status, priority: r.priority ?? null },
    });
  }

  for (const m of (membersRes.data ?? []) as Array<Record<string, any>>) {
    const p = m.profiles;
    if (!p?.id || !p.full_name) continue;
    const role = ROLE_LABEL[m.role] ?? m.role ?? "Membro";
    docs.push({
      entity_type: "member",
      entity_id: p.id,
      title: p.full_name,
      content: `Membro do quadro: ${p.full_name}. Papel: ${role}. ${p.job_title ? `Cargo: ${p.job_title}.` : ""}`,
      metadata: { role, job_title: p.job_title ?? null },
    });
  }

  for (const s of (servicesRes.data ?? []) as Array<Record<string, any>>) {
    if (s.is_folder) continue;
    docs.push({
      entity_type: "service",
      entity_id: s.id,
      title: s.name,
      content: [
        `Serviço do quadro: ${s.name}.`,
        clean(s.description),
        s.estimated_hours ? `Horas estimadas: ${s.estimated_hours}.` : "",
        s.is_active === false ? "Serviço inativo." : "",
      ].filter(Boolean).join(" "),
      metadata: { estimated_hours: s.estimated_hours ?? null, active: s.is_active !== false },
    });
  }

  return docs;
}

export async function indexBoard(
  admin: SupabaseClient,
  boardId: string,
  tz: string,
  options: { full?: boolean } = {},
): Promise<{ total: number; embedded: number; removed: number }> {
  const docs = await buildBoardDocs(admin, boardId, tz);

  const hashes = await Promise.all(docs.map((d) => sha256(`${d.title}\n${d.content}`)));

  const { data: existing } = await admin
    .from("search_documents")
    .select("entity_type,entity_id,content_hash")
    .eq("board_id", boardId);

  const existingMap = new Map<string, string>();
  for (const e of existing ?? []) {
    existingMap.set(`${(e as any).entity_type}:${(e as any).entity_id}`, (e as any).content_hash);
  }

  const stale: Array<{ doc: SearchDoc; hash: string }> = [];
  docs.forEach((doc, i) => {
    const key = `${doc.entity_type}:${doc.entity_id}`;
    if (options.full || existingMap.get(key) !== hashes[i]) stale.push({ doc, hash: hashes[i] });
  });

  let embedded = 0;
  if (stale.length > 0) {
    const vectors = await embedDocuments(stale.map(({ doc }) => `${doc.title}\n${doc.content}`));
    const rows = stale.map(({ doc, hash }, i) => ({
      board_id: boardId,
      entity_type: doc.entity_type,
      entity_id: doc.entity_id,
      title: doc.title,
      content: doc.content,
      metadata: doc.metadata,
      content_hash: hash,
      embedding: JSON.stringify(vectors[i]),
      updated_at: new Date().toISOString(),
    }));

    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await admin
        .from("search_documents")
        .upsert(rows.slice(i, i + 100), { onConflict: "board_id,entity_type,entity_id" });
      if (error) throw new Error(`Falha ao gravar índice: ${error.message}`);
    }
    embedded = rows.length;
  }

  // Remove documentos de itens que não existem mais.
  const currentKeys = new Set(docs.map((d) => `${d.entity_type}:${d.entity_id}`));
  const orphans = (existing ?? []).filter(
    (e: any) => !currentKeys.has(`${e.entity_type}:${e.entity_id}`),
  );
  let removed = 0;
  for (const o of orphans as any[]) {
    await admin
      .from("search_documents")
      .delete()
      .eq("board_id", boardId)
      .eq("entity_type", o.entity_type)
      .eq("entity_id", o.entity_id);
    removed++;
  }

  return { total: docs.length, embedded, removed };
}
