import type { ReactNode } from "react";
import type { DynamicToolUIPart, ToolUIPart } from "ai";
import { getToolName } from "ai";
import {
  BarChart3,
  ListChecks,
  Users,
  Inbox,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CalendarClock,
} from "lucide-react";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ToolMeta = { title: string; icon: ReactNode };

const TOOL_META: Record<string, ToolMeta> = {
  get_board_metrics: { title: "Métricas do quadro", icon: <BarChart3 className="size-4 text-primary" /> },
  list_demands: { title: "Lista de demandas", icon: <ListChecks className="size-4 text-primary" /> },
  get_board_members: { title: "Membros do quadro", icon: <Users className="size-4 text-primary" /> },
  list_demand_requests: { title: "Solicitações de demanda", icon: <Inbox className="size-4 text-primary" /> },
};

function fmt(n: unknown, suffix = ""): string {
  if (n === null || n === undefined || n === "") return "—";
  if (typeof n === "number") return `${Number.isInteger(n) ? n : n.toFixed(1)}${suffix}`;
  return `${n}${suffix}`;
}

function fmtDate(iso: unknown): string {
  if (typeof iso !== "string" || iso.length < 10) return "—";
  const [y, m, d] = iso.substring(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

// ---------- Métricas ----------

type MetricsOutput = {
  period?: { from?: string | null; to?: string | null } | null;
  scope?: { member_name?: string | null } | null;
  current?: Record<string, unknown> & {
    by_responsible?: Array<{ name: string; open: number; overdue: number; delivered: number }>;
    by_stage?: Array<{ name: string; count: number; overdue: number; color?: string }>;
  };
  period_flow?: Record<string, unknown> & {
    requests?: Record<string, unknown>;
  };
  monthly_limit?: { limit?: number | null; used_this_month?: number; remaining?: number | null };
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" | "success" | "warning" }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold leading-tight",
          tone === "danger" && "text-destructive",
          tone === "success" && "text-emerald-600 dark:text-emerald-400",
          tone === "warning" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function MetricsView({ output }: { output: MetricsOutput }) {
  const cur = output.current ?? {};
  const flow = output.period_flow ?? {};
  const hasPeriod = !!(output.period?.from || output.period?.to);
  const scopeLabel = [
    output.scope?.member_name ? `Responsável: ${output.scope.member_name}` : null,
    hasPeriod ? `Período: ${fmtDate(output.period?.from)} – ${fmtDate(output.period?.to)}` : "Histórico completo",
  ]
    .filter(Boolean)
    .join(" · ");

  const overdue = Number(cur.overdue ?? 0);
  const onTimeRate = flow.on_time_rate as number | null | undefined;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{scopeLabel}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Abertas" value={fmt(cur.open)} />
        <Stat label="Vencidas" value={fmt(cur.overdue)} tone={overdue > 0 ? "danger" : "success"} />
        <Stat label="Vencem em 7 dias" value={fmt(cur.due_soon_7d)} tone={Number(cur.due_soon_7d ?? 0) > 0 ? "warning" : undefined} />
        <Stat label="Entregues (total)" value={fmt(cur.delivered_total)} />
        <Stat label="Criadas no período" value={fmt(flow.created)} />
        <Stat label="Entregues no período" value={fmt(flow.delivered)} />
        <Stat label="No prazo / com atraso" value={`${fmt(flow.delivered_on_time)} / ${fmt(flow.delivered_late)}`} />
        <Stat
          label="Pontualidade"
          value={onTimeRate == null ? "—" : `${onTimeRate}%`}
          tone={onTimeRate == null ? undefined : onTimeRate >= 80 ? "success" : onTimeRate >= 60 ? "warning" : "danger"}
        />
      </div>
      {output.monthly_limit?.limit ? (
        <p className="text-xs text-muted-foreground">
          Limite mensal: <span className="font-medium text-foreground">{output.monthly_limit.used_this_month}</span> de{" "}
          <span className="font-medium text-foreground">{output.monthly_limit.limit}</span> usadas
          {output.monthly_limit.remaining != null && ` · restam ${output.monthly_limit.remaining}`}
        </p>
      ) : null}
      {Array.isArray(cur.by_responsible) && cur.by_responsible.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left font-medium">Responsável</th>
                <th className="px-2 py-1.5 text-right font-medium">Abertas</th>
                <th className="px-2 py-1.5 text-right font-medium">Vencidas</th>
                <th className="px-2 py-1.5 text-right font-medium">Entregues</th>
              </tr>
            </thead>
            <tbody>
              {cur.by_responsible.slice(0, 8).map((r) => (
                <tr key={r.name} className="border-t border-border/60">
                  <td className="px-2 py-1.5">{r.name}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.open}</td>
                  <td className={cn("px-2 py-1.5 text-right tabular-nums", r.overdue > 0 && "text-destructive font-medium")}>{r.overdue}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">{r.delivered}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------- Demandas ----------

type DemandRow = {
  id: string;
  code?: string | null;
  title: string;
  stage?: string | null;
  priority?: string | null;
  responsible?: string | null;
  due_on?: string | null;
  status: string;
  days_overdue?: number;
  days_late?: number;
  due_in_days?: number;
  delivered_on?: string;
};

type DemandsOutput = { filter: string; total_matching: number; returned: number; truncated?: boolean; demands: DemandRow[] };

const STATUS_STYLE: Record<string, { label: string; className: string; icon: ReactNode }> = {
  vencida: { label: "Vencida", className: "border-destructive/30 bg-destructive/10 text-destructive", icon: <AlertTriangle className="size-3" /> },
  aberta: { label: "Aberta", className: "border-border bg-muted text-foreground", icon: <Clock className="size-3" /> },
  entregue_no_prazo: { label: "No prazo", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: <CheckCircle2 className="size-3" /> },
  entregue_com_atraso: { label: "Com atraso", className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400", icon: <CalendarClock className="size-3" /> },
  entregue_sem_prazo: { label: "Entregue", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", icon: <CheckCircle2 className="size-3" /> },
};

function DemandsView({ output }: { output: DemandsOutput }) {
  if (!output.demands?.length) {
    return <p className="text-xs text-muted-foreground">Nenhuma demanda encontrada para esse filtro.</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{output.returned}</span> de{" "}
        <span className="font-medium text-foreground">{output.total_matching}</span>
      </p>
      <ul className="divide-y divide-border/60 rounded-md border border-border/60">
        {output.demands.map((d) => {
          const st = STATUS_STYLE[d.status] ?? STATUS_STYLE.aberta;
          const detail =
            d.status === "vencida" && d.days_overdue != null
              ? `${d.days_overdue}d de atraso`
              : d.status === "entregue_com_atraso" && d.days_late != null
                ? `${d.days_late}d após o prazo`
                : d.status === "aberta" && d.due_in_days != null
                  ? d.due_in_days === 0
                    ? "vence hoje"
                    : `vence em ${d.due_in_days}d`
                  : d.delivered_on
                    ? `entregue em ${fmtDate(d.delivered_on)}`
                    : d.due_on
                      ? `prazo ${fmtDate(d.due_on)}`
                      : "sem prazo";
          return (
            <li key={d.id} className="flex items-start justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">
                  {d.code && <span className="mr-1.5 text-muted-foreground">{d.code}</span>}
                  {d.title}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {d.responsible ?? "Sem responsável"}
                  {d.stage && ` · ${d.stage}`}
                  {d.priority && ` · ${d.priority}`}
                  {` · ${detail}`}
                </p>
              </div>
              <Badge variant="outline" className={cn("shrink-0 gap-1 rounded-full text-[10px] font-medium", st.className)}>
                {st.icon}
                {st.label}
              </Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Membros ----------

type MembersOutput = { total: number; members: Array<{ user_id: string; name: string; role: string; role_key: string }> };

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-primary/15 text-primary border-primary/30",
  moderator: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/30",
  executor: "bg-muted text-foreground border-border",
  requester: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
};

function MembersView({ output }: { output: MembersOutput }) {
  if (!output.members?.length) return <p className="text-xs text-muted-foreground">Este quadro ainda não tem membros.</p>;
  return (
    <ul className="grid gap-1.5 sm:grid-cols-2">
      {output.members.map((m) => (
        <li key={m.user_id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-1.5">
          <span className="truncate text-xs font-medium">{m.name}</span>
          <Badge variant="outline" className={cn("shrink-0 rounded-full text-[10px]", ROLE_BADGE[m.role_key] ?? ROLE_BADGE.executor)}>
            {m.role}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

// ---------- Solicitações ----------

type RequestsOutput = {
  total_matching: number;
  returned: number;
  requests: Array<{ id: string; title: string; status: string; requester: string; service?: string; created_on?: string; priority?: string }>;
};

function RequestsView({ output }: { output: RequestsOutput }) {
  if (!output.requests?.length) return <p className="text-xs text-muted-foreground">Nenhuma solicitação encontrada.</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{output.returned}</span> de{" "}
        <span className="font-medium text-foreground">{output.total_matching}</span>
      </p>
      <ul className="divide-y divide-border/60 rounded-md border border-border/60">
        {output.requests.map((r) => (
          <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">{r.title}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {r.requester}
                {r.service && ` · ${r.service}`}
                {r.created_on && ` · ${fmtDate(r.created_on)}`}
              </p>
            </div>
            <Badge variant="outline" className="shrink-0 rounded-full text-[10px] capitalize">
              {r.status}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Wrapper ----------

function renderOutput(toolName: string, output: unknown): ReactNode {
  if (!output || typeof output !== "object") return null;
  const o = output as Record<string, unknown>;
  if (typeof o.error === "string") {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {o.error}
      </div>
    );
  }
  switch (toolName) {
    case "get_board_metrics":
      return <MetricsView output={output as MetricsOutput} />;
    case "list_demands":
      return <DemandsView output={output as DemandsOutput} />;
    case "get_board_members":
      return <MembersView output={output as MembersOutput} />;
    case "list_demand_requests":
      return <RequestsView output={output as RequestsOutput} />;
    default:
      return null;
  }
}

export function BoardAgentToolPart({ part }: { part: ToolUIPart | DynamicToolUIPart }) {
  const toolName = part.type === "dynamic-tool" ? part.toolName : getToolName(part);
  const meta = TOOL_META[toolName] ?? { title: toolName, icon: undefined };
  const custom = part.state === "output-available" ? renderOutput(toolName, part.output) : null;

  return (
    <Tool defaultOpen={false} className="mb-2 bg-card/60">
      {part.type === "dynamic-tool" ? (
        <ToolHeader type={part.type} state={part.state} toolName={part.toolName} title={meta.title} icon={meta.icon} className="py-2" />
      ) : (
        <ToolHeader type={part.type} state={part.state} title={meta.title} icon={meta.icon} className="py-2" />
      )}
      <ToolContent className="space-y-3 p-3">
        {part.input !== undefined && Object.keys((part.input as object) ?? {}).some((k) => (part.input as Record<string, unknown>)[k] != null) ? (
          <ToolInput input={part.input} />
        ) : (
          <p className="text-[11px] text-muted-foreground">Sem parâmetros: consulta do quadro inteiro.</p>
        )}
        {custom ? (
          <div className="space-y-2">
            <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Resultado</h4>
            {custom}
          </div>
        ) : (
          <ToolOutput output={part.state === "output-available" ? part.output : undefined} errorText={part.state === "output-error" ? part.errorText : undefined} />
        )}
      </ToolContent>
    </Tool>
  );
}
