import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, CheckCircle2, Clock3, Eye, Loader2, MailCheck, MailX, MessageSquareText, Search, UserRoundCheck } from "lucide-react";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";
import { useDemoRequests, useUpdateDemoRequest, type DemoRequest, type DemoRequestStatus } from "@/hooks/admin/useDemoRequests";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STATUS_META: Record<DemoRequestStatus, { label: string; className: string }> = {
  new: { label: "Nova", className: "border-primary/30 bg-primary/10 text-primary" },
  contacted: { label: "Contato feito", className: "border-secondary/30 bg-secondary/10 text-secondary" },
  scheduled: { label: "Demo agendada", className: "border-warning/30 bg-warning/10 text-warning" },
  won: { label: "Convertida", className: "border-success/30 bg-success/10 text-success" },
  lost: { label: "Perdida", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  archived: { label: "Arquivada", className: "border-border bg-muted text-muted-foreground" },
};

const EMAIL_META = {
  pending: { label: "Pendente", className: "border-warning/30 bg-warning/10 text-warning" },
  sent: { label: "Enviado", className: "border-success/30 bg-success/10 text-success" },
  failed: { label: "Falhou", className: "border-destructive/30 bg-destructive/10 text-destructive" },
};

const statusOptions = Object.entries(STATUS_META).map(([value, meta]) => ({ value: value as DemoRequestStatus, label: meta.label }));

export default function AdminDemoRequests() {
  const { data: requests, isLoading } = useDemoRequests();
  const updateRequest = useUpdateDemoRequest();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DemoRequestStatus | "all">("all");
  const [selected, setSelected] = useState<DemoRequest | null>(null);
  const [editStatus, setEditStatus] = useState<DemoRequestStatus>("new");
  const [notes, setNotes] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (requests ?? []).filter((request) => {
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      if (!matchesStatus) return false;
      if (!normalized) return true;
      return [request.name, request.email, request.company, request.phone, request.role, request.team_size]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(normalized));
    });
  }, [requests, query, statusFilter]);

  const stats = useMemo(() => {
    const base = { total: requests?.length ?? 0, new: 0, scheduled: 0, won: 0, emailFailed: 0 };
    for (const request of requests ?? []) {
      if (request.status === "new") base.new += 1;
      if (request.status === "scheduled") base.scheduled += 1;
      if (request.status === "won") base.won += 1;
      if (request.email_status === "failed") base.emailFailed += 1;
    }
    return base;
  }, [requests]);

  const openRequest = (request: DemoRequest) => {
    setSelected(request);
    setEditStatus(request.status);
    setNotes(request.internal_notes ?? "");
  };

  const saveRequest = async () => {
    if (!selected) return;
    try {
      await updateRequest.mutateAsync({ id: selected.id, status: editStatus, internal_notes: notes });
      toast.success("Solicitação atualizada");
      setSelected(null);
    } catch (error) {
      console.error("demo request update failed:", error);
      toast.error("Não foi possível atualizar a solicitação");
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <SEOHead title="Admin - Demonstrações" noindex />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Solicitações de demonstração</h1>
          <p className="text-sm text-muted-foreground">Acompanhe os leads enviados pela landing pública do SoMA+.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, empresa ou e-mail" className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as DemoRequestStatus | "all")}>
            <SelectTrigger className="w-full sm:w-52">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total", value: stats.total, icon: MessageSquareText },
          { label: "Novas", value: stats.new, icon: Clock3 },
          { label: "Agendadas", value: stats.scheduled, icon: CalendarDays },
          { label: "Convertidas", value: stats.won, icon: UserRoundCheck },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <stat.icon className="h-3.5 w-3.5" />
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.emailFailed > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {stats.emailFailed} solicitação(ões) foram registradas, mas o e-mail para vendas falhou.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Solicitações</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-14 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <MessageSquareText className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p>Nenhuma solicitação encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Recebido em</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((request) => {
                  const statusMeta = STATUS_META[request.status];
                  const emailMeta = EMAIL_META[request.email_status];
                  return (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{request.name}</p>
                          <p className="text-xs text-muted-foreground">{request.email}</p>
                          {request.phone && <p className="text-xs text-muted-foreground">{request.phone}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{request.company}</p>
                        <p className="text-xs text-muted-foreground">{[request.role, request.team_size].filter(Boolean).join(" • ") || "—"}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("whitespace-nowrap", statusMeta.className)}>{statusMeta.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("whitespace-nowrap", emailMeta.className)}>
                          {request.email_status === "failed" ? <MailX className="mr-1 h-3 w-3" /> : <MailCheck className="mr-1 h-3 w-3" />}
                          {emailMeta.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {format(new Date(request.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openRequest(request)} aria-label="Ver solicitação">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar solicitação</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="grid gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:grid-cols-2">
                <InfoItem label="Nome" value={selected.name} />
                <InfoItem label="Empresa" value={selected.company} />
                <InfoItem label="E-mail" value={selected.email} />
                <InfoItem label="Telefone" value={selected.phone ?? "Não informado"} />
                <InfoItem label="Cargo" value={selected.role ?? "Não informado"} />
                <InfoItem label="Tamanho do time" value={selected.team_size ?? "Não informado"} />
              </div>

              {selected.message && (
                <div className="rounded-xl border border-border p-4">
                  <p className="mb-2 text-sm font-semibold">Mensagem</p>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{selected.message}</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={editStatus} onValueChange={(value) => setEditStatus(value as DemoRequestStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>E-mail para vendas</Label>
                  <div className="flex h-10 items-center rounded-md border border-input bg-muted/50 px-3 text-sm text-muted-foreground">
                    {EMAIL_META[selected.email_status].label}
                  </div>
                </div>
              </div>

              {selected.email_error && (
                <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                  {selected.email_error}
                </div>
              )}

              <div className="space-y-2">
                <Label>Observações internas</Label>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-32" placeholder="Registre próximos passos, retorno comercial ou motivo de arquivamento." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button onClick={saveRequest} disabled={updateRequest.isPending}>
              {updateRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
