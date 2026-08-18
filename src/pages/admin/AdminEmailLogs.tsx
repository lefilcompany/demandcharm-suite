import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2, Mail, MailX, ShieldCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type Preset = "24h" | "7d" | "30d" | "custom";

interface LogRow {
  id: string;
  message_id: string | null;
  template_name: string;
  event_type: string;
  recipient_email: string;
  subject: string;
  status: string;
  source_function: string | null;
  error_message: string | null;
  created_at: string;
}

const STATUS_META: Record<string, { label: string; className: string }> = {
  sent: { label: "Enviado", className: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
  failed: { label: "Falhou", className: "bg-red-500/15 text-red-600 border-red-500/30" },
  skipped_duplicate: {
    label: "Duplicado (bloqueado)",
    className: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  },
  skipped_preference: {
    label: "Preferência do usuário",
    className: "bg-muted text-muted-foreground border-border",
  },
};

const PAGE_SIZE = 50;

function rangeStart(preset: Preset, customFrom?: Date): Date {
  if (preset === "24h") return new Date(Date.now() - 24 * 60 * 60 * 1000);
  if (preset === "30d") return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  if (preset === "custom" && customFrom) return customFrom;
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
}

export default function AdminEmailLogs() {
  const [preset, setPreset] = useState<Preset>("7d");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [eventType, setEventType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(0);

  const start = useMemo(() => rangeStart(preset, customFrom), [preset, customFrom]);
  const end = useMemo(
    () => (preset === "custom" && customTo ? new Date(customTo.getTime() + 86_400_000) : new Date()),
    [preset, customTo],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin-email-logs", start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select(
          "id, message_id, template_name, event_type, recipient_email, subject, status, source_function, error_message, created_at",
        )
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data || []) as LogRow[];
    },
    staleTime: 60_000,
  });

  // Deduplicate by message_id keeping the most recent row per email.
  const deduped = useMemo(() => {
    const seen = new Map<string, LogRow>();
    for (const row of data || []) {
      const key = row.message_id || row.id;
      if (!seen.has(key)) seen.set(key, row);
    }
    return Array.from(seen.values());
  }, [data]);

  const eventTypes = useMemo(
    () => Array.from(new Set(deduped.map((r) => r.event_type))).sort(),
    [deduped],
  );

  const filtered = useMemo(
    () =>
      deduped.filter(
        (r) =>
          (eventType === "all" || r.event_type === eventType) &&
          (status === "all" || r.status === status),
      ),
    [deduped, eventType, status],
  );

  const stats = useMemo(() => {
    const base = { total: filtered.length, sent: 0, failed: 0, duplicate: 0, preference: 0 };
    for (const r of filtered) {
      if (r.status === "sent") base.sent++;
      else if (r.status === "failed") base.failed++;
      else if (r.status === "skipped_duplicate") base.duplicate++;
      else if (r.status === "skipped_preference") base.preference++;
    }
    return base;
  }, [filtered]);

  const pageRows = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="p-4 md:p-6 space-y-6 overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Logs de e-mail</h1>
        <p className="text-sm text-muted-foreground">
          Registro de todos os envios, destinatários e bloqueios por duplicidade. Contém dados
          sensíveis — visível apenas para administradores.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2 pt-6">
          {(["24h", "7d", "30d"] as Preset[]).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={preset === p ? "default" : "outline"}
              className="h-8 rounded-full"
              onClick={() => {
                setPreset(p);
                setPage(0);
              }}
            >
              {p === "24h" ? "Últimas 24h" : p === "7d" ? "7 dias" : "30 dias"}
            </Button>
          ))}

          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant={preset === "custom" ? "default" : "outline"}
                className="h-8 rounded-full"
              >
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {preset === "custom" && customFrom
                  ? `${format(customFrom, "dd/MM", { locale: ptBR })} – ${
                      customTo ? format(customTo, "dd/MM", { locale: ptBR }) : "hoje"
                    }`
                  : "Período personalizado"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: customFrom, to: customTo }}
                onSelect={(range: any) => {
                  setCustomFrom(range?.from);
                  setCustomTo(range?.to);
                  setPreset("custom");
                  setPage(0);
                }}
                locale={ptBR}
                className={cn("pointer-events-auto p-3")}
              />
            </PopoverContent>
          </Popover>

          <Select
            value={eventType}
            onValueChange={(v) => {
              setEventType(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-8 w-[220px] rounded-full">
              <SelectValue placeholder="Tipo de e-mail" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {eventTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="h-8 w-[200px] rounded-full">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="sent">Enviado</SelectItem>
              <SelectItem value="failed">Falhou</SelectItem>
              <SelectItem value="skipped_duplicate">Duplicado (bloqueado)</SelectItem>
              <SelectItem value="skipped_preference">Preferência do usuário</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total", value: stats.total, icon: Mail },
          { label: "Enviados", value: stats.sent, icon: ShieldCheck },
          { label: "Falhas", value: stats.failed, icon: AlertTriangle },
          { label: "Duplicados bloqueados", value: stats.duplicate, icon: MailX },
          { label: "Bloqueados por preferência", value: stats.preference, icon: MailX },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <s.icon className="h-3.5 w-3.5" />
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Envios</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : pageRows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhum envio registrado no período selecionado.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Destinatário</TableHead>
                      <TableHead>Assunto</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageRows.map((r) => {
                      const meta = STATUS_META[r.status] || {
                        label: r.status,
                        className: "bg-muted text-muted-foreground border-border",
                      };
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs font-medium">{r.event_type}</TableCell>
                          <TableCell className="text-xs">{r.recipient_email}</TableCell>
                          <TableCell className="max-w-[280px] truncate text-xs">
                            {r.subject}
                            {r.error_message && (
                              <span className="block text-[11px] text-red-500">
                                {r.error_message}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cn("text-[11px]", meta.className)}>
                              {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.source_function || "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Página {page + 1} de {totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      Anterior
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={page + 1 >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
