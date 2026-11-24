import { CurrencyInput } from "@/components/ui/currency-input";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, AlertCircle, Info, ChevronRight, ChevronLeft, CalendarDays, RefreshCw, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFinanceMutation, useMemberRates, type MemberRate, type PeopleRow } from "@/hooks/useFinance";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { OpsLabel } from "@/components/ops/OpsParts";
import { AllocationBar, OccupancyRuler } from "@/components/finance/AllocationBar";
import { costPerHour, formatBRL, formatPct } from "@/lib/finance/engine";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const hrs = (h: number) => `${h.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
const monthLabel = (iso: string) => new Date(`${iso.substring(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

export function CostsProductivity({ rows, detailed, isLoading, isError, onRetry, boardOrder, teamId, canEdit, limit, allHref }: {
  rows: PeopleRow[]; detailed: boolean; isLoading: boolean; isError: boolean; onRetry: () => void; boardOrder: string[];
  teamId: string | null; canEdit: boolean; limit?: number; allHref?: string;
}) {
  const { user } = useAuth();
  const members = useQuery({
    queryKey: ["finance-team-members", teamId, user?.id],
    enabled: !!teamId && !!user && detailed,
    queryFn: async () => {
      const { data: tm, error } = await supabase.from("team_members").select("user_id").eq("team_id", teamId!);
      if (error) throw error;
      const ids = (tm ?? []).map((r) => r.user_id);
      if (!ids.length) return [] as { id: string; name: string }[];
      const { data: pf, error: e2 } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      if (e2) throw e2;
      const names = new Map((pf ?? []).map((p) => [p.id, p.full_name]));
      return ids.map((id) => ({ id, name: names.get(id) || "Pessoa" }));
    },
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const rates = useMemberRates(teamId, detailed);
  const rateBy = useMemo(() => new Map((rates.data ?? []).map((r) => [r.user_id, r])), [rates.data]);
  const people = useMemo(() => {
    const m = new Map<string, { userId: string; name: string; month: string; cost: number | null; ref: number | null; hours: number; boards: PeopleRow[] }>();
    rows.filter((r) => r.user_id).forEach((r) => {
      const k = `${r.user_id}|${r.competence}`;
      const p = m.get(k) ?? { userId: r.user_id!, name: r.full_name ?? "Pessoa", month: r.competence, cost: r.monthly_cost, ref: r.productive_hours, hours: 0, boards: [] };
      p.hours += r.hours;
      if (r.board_id) p.boards.push(r);
      m.set(k, p);
    });
    return [...m.values()].sort((a, b) => b.month.localeCompare(a.month) || a.name.localeCompare(b.name));
  }, [rows]);
  const persons = useMemo<Person[]>(() => {
    const m = new Map<string, Person>();
    people.forEach((pm) => {
      const p = m.get(pm.userId) ?? { userId: pm.userId, name: pm.name, months: [] };
      p.months.push(pm); m.set(pm.userId, p);
    });
    (members.data ?? []).forEach((u) => { if (!m.has(u.id)) m.set(u.id, { userId: u.id, name: u.name, months: [] }); });
    return [...m.values()].sort((a, b) => Number(hasGap(b)) - Number(hasGap(a)) || a.name.localeCompare(b.name));
  }, [people, members.data]);
  const totals = useMemo(() => {
    const hours = rows.reduce((s, r) => s + r.hours, 0);
    const cost = rows.reduce((s, r) => s + (r.cost ?? 0), 0);
    const ref = people.reduce((s, p) => s + (p.ref ?? 0), 0);
    return { hours, cost, occupancy: detailed && ref > 0 ? people.reduce((s, p) => s + (p.ref ? p.hours : 0), 0) / ref : null };
  }, [rows, people, detailed]);

  if (isError) return (
    <div className="rounded-xl border p-6 text-center space-y-2">
      <p className="text-sm">Não foi possível carregar custos e horas.</p>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={onRetry}><RefreshCw className="h-4 w-4" />Tentar de novo</Button>
    </div>
  );
  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const missing = people.filter((p) => p.cost == null && p.hours > 0);
  const over = people.filter((p) => p.ref && p.hours / p.ref > 1);
  const under = people.filter((p) => p.ref && p.hours / p.ref < 0.5);

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-ops-ink text-ops-ink-foreground grid grid-cols-1 sm:grid-cols-3">
        {[
          { l: "Horas apontadas", v: hrs(totals.hours) },
          { l: "Custo das horas", v: formatBRL(totals.cost) },
          { l: "Ocupação média", v: totals.occupancy === null ? "—" : formatPct(totals.occupancy) },
        ].map((m) => (
          <div key={m.l} className="px-5 py-3 [&:not(:first-child)]:sm:border-l border-ops-ink-foreground/10">
            <OpsLabel>{m.l}</OpsLabel><div className="font-ops-display text-3xl font-semibold tabular-nums">{m.v}</div>
          </div>
        ))}
      </section>

      {!detailed && (
        <p className="text-sm text-muted-foreground rounded-lg border px-3 py-2">
          Você vê só os totais dos quadros liberados. O custo de cada pessoa aparece para quem tem a permissão "Ver custo de cada pessoa".
        </p>
      )}

      {detailed && (missing.length > 0 || over.length > 0 || under.length > 0) && (
        <ul className="grid gap-2 md:grid-cols-3 text-sm">
          {missing.length > 0 && <Alert title={`${missing.length} sem custo/hora`} body={`As horas de ${missing.map((p) => p.name.split(" ")[0]).slice(0, 3).join(", ")} não entram no custo. Clique no cartão da pessoa e configure o custo mensal.`} tone="danger" />}
          {over.length > 0 && <Alert title={`${over.length} acima de 100%`} body="Apontaram mais horas que a referência configurada. Confira as horas produtivas ou a carga." tone="warn" />}
          {under.length > 0 && <Alert title={`${under.length} abaixo de 50%`} body="Pouco tempo apontado. Pode ser timer esquecido ou capacidade livre." tone="info" />}
        </ul>
      )}

      {detailed && (
        persons.length === 0
          ? <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">{members.isLoading ? "Carregando pessoas…" : "Nenhuma pessoa na equipe."}</p>
          : <div className="space-y-3">
              <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
                {(limit ? persons.slice(0, limit) : persons).map((p) => <PersonCard key={p.userId} p={p} rate={rateBy.get(p.userId)} onOpen={() => setOpenId(p.userId)} />)}
              </div>
              {limit && allHref && persons.length > limit && (
                <div className="flex justify-center"><Button asChild variant="outline" size="sm" className="gap-1.5 rounded-full">
                  <Link to={allHref}>Ver todas as {persons.length} pessoas<ChevronRight className="h-4 w-4" /></Link></Button></div>
              )}
            </div>
      )}

      <PersonSheet person={persons.find((p) => p.userId === openId) ?? null} rate={openId ? rateBy.get(openId) : undefined}
        onClose={() => setOpenId(null)} teamId={teamId} canEdit={canEdit} boardOrder={boardOrder} />

      {!detailed && (
        <div className="rounded-xl border bg-card divide-y text-sm">
          {rows.length === 0 && <p className="p-6 text-center text-muted-foreground">Nenhuma hora apontada nos quadros liberados.</p>}
          {Object.values(rows.reduce<Record<string, { name: string; h: number; c: number }>>((m, r) => {
            const k = r.board_id ?? "-"; m[k] = { name: r.board_name ?? "Quadro", h: (m[k]?.h ?? 0) + r.hours, c: (m[k]?.c ?? 0) + (r.cost ?? 0) }; return m;
          }, {})).map((b) => (
            <div key={b.name} className="flex justify-between gap-3 px-4 py-2"><span className="truncate">{b.name}</span><span className="tabular-nums">{hrs(b.h)} · {formatBRL(b.c)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

function Alert({ title, body, tone }: { title: string; body: string; tone: "danger" | "warn" | "info" }) {
  const t = {
    danger: { box: "border-destructive/40 bg-destructive/10", icon: "bg-destructive text-destructive-foreground", title: "text-destructive", Icon: AlertTriangle },
    warn: { box: "border-primary/40 bg-primary/10", icon: "bg-primary text-primary-foreground", title: "text-primary", Icon: AlertCircle },
    info: { box: "border-border bg-muted/60", icon: "bg-muted-foreground/20 text-foreground", title: "text-foreground", Icon: Info },
  }[tone];
  return (
    <li role="alert" className={`flex gap-3 rounded-xl border border-l-4 p-3 ${t.box}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${t.icon}`}><t.Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <p className={`font-semibold leading-tight ${t.title}`}>{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}

type PersonMonth = { userId: string; name: string; month: string; cost: number | null; ref: number | null; hours: number; boards: PeopleRow[] };
type Person = { userId: string; name: string; months: PersonMonth[] };
const hasGap = (p: Person) => p.months.some((m) => m.cost == null && m.hours > 0);
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function PersonCard({ p, rate, onOpen }: { p: Person; rate?: MemberRate; onOpen: () => void }) {
  const last = p.months[0] as PersonMonth | undefined;
  const priced = p.months.find((m) => m.cost != null && m.ref);
  const cph = rate ? costPerHour(rate.monthly_cost, rate.productive_hours) : priced ? costPerHour(priced.cost!, priced.ref!) : null;
  const hours = p.months.reduce((s, m) => s + m.hours, 0);
  const occ = last?.ref ? last.hours / last.ref : null;
  const gap = hasGap(p);
  return (
    <button type="button" onClick={onOpen}
      className={`group text-left rounded-xl border bg-card p-4 space-y-3 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${gap ? "border-primary/50" : ""}`}>
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted font-semibold text-xs">{initials(p.name)}</span>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{p.name}</p>
          <p className="text-xs text-muted-foreground">{hrs(hours)} no período</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
      </div>
      <div>
        <OpsLabel>Hora/homem</OpsLabel>
        {cph == null
          ? <p className="text-primary text-sm font-medium inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />Sem custo cadastrado</p>
          : <p className="font-ops-display text-2xl font-semibold tabular-nums">{formatBRL(cph)}<span className="text-xs font-normal text-muted-foreground"> /h · configuração atual</span></p>}
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground"><span>Ocupação{last ? ` · ${monthLabel(last.month)}` : ""}</span><span className="tabular-nums">{occ == null ? "—" : `${Math.round(occ * 100)}%`}</span></div>
        <OccupancyRuler value={occ} />
      </div>
      {gap && <p className="text-xs text-primary">Há horas sem custo — clique para configurar.</p>}
    </button>
  );
}

function PersonSheet({ person, rate, onClose, teamId, canEdit, boardOrder }: {
  person: Person | null; rate?: MemberRate; onClose: () => void; teamId: string | null; canEdit: boolean; boardOrder: string[];
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({ amount: "", hours: "" });
  useEffect(() => {
    if (!person) return;
    const lastCost = person.months.find((m) => m.cost != null && m.ref);
    setForm({
      amount: rate ? String(rate.monthly_cost) : lastCost?.cost != null ? String(lastCost.cost) : "",
      hours: String(rate?.productive_hours ?? lastCost?.ref ?? 160),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.userId, rate?.monthly_cost, rate?.productive_hours]);

  const save = useFinanceMutation(async () => {
    const payload = { monthly_cost: Number(form.amount), productive_hours: Number(form.hours), updated_by: user!.id, updated_at: new Date().toISOString() };
    const q = rate
      ? supabase.from("finance_member_rates").update(payload).eq("team_id", teamId!).eq("user_id", person!.userId)
      : supabase.from("finance_member_rates").insert({ team_id: teamId!, user_id: person!.userId, ...payload, created_by: user!.id });
    const { error } = await q;
    if (error) throw error;
  });
  const amount = Number(form.amount), hours = Number(form.hours);
  const preview = amount > 0 && hours > 0 ? amount / hours : null;
  const valid = amount > 0 && hours > 0 && hours <= 744;

  return (
    <Sheet open={!!person} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {person && (<>
          <SheetHeader className="text-left">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-muted font-semibold">{initials(person.name)}</span>
              <div><SheetTitle>{person.name}</SheetTitle><SheetDescription>Hora/homem, horas e destino do custo</SheetDescription></div>
            </div>
          </SheetHeader>

          {canEdit ? (
            <form className="mt-5 rounded-xl border p-4 space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(undefined, {
              onSuccess: () => toast.success("Configuração salva"), onError: (err: any) => toast.error(err?.message ?? "Não foi possível salvar a configuração") }); }}>
              <p className="font-semibold text-sm">Configurar hora/homem</p>
              <p className="text-xs text-muted-foreground">Vale para todos os meses até ser trocada. Meses já fechados continuam com o valor que tinham.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label htmlFor="pc-amount">Custo mensal (R$)</Label>
                  <CurrencyInput id="pc-amount" value={form.amount} onValueChange={(v) => setForm({ ...form, amount: v })} /></div>
                <div className="space-y-1"><Label htmlFor="pc-hours">Horas produtivas</Label>
                  <Input id="pc-hours" type="number" min="1" max="744" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></div>
              </div>
              <div className="flex items-end justify-between gap-3 rounded-lg bg-muted px-3 py-2">
                <div><OpsLabel>Hora/homem</OpsLabel><p className="font-ops-display text-xl font-semibold tabular-nums">{preview == null ? "—" : formatBRL(preview)}</p></div>
                <Button type="submit" size="sm" disabled={!valid || save.isPending} className="gap-1.5"><Save className="h-4 w-4" />Salvar configuração</Button>
              </div>
            </form>
          ) : <p className="mt-5 text-xs text-muted-foreground rounded-lg border px-3 py-2">Para alterar a hora/homem é preciso a permissão "Gerenciar configurações".</p>}

          <MonthHistory person={person} boardOrder={boardOrder} />
        </>)}
      </SheetContent>
    </Sheet>
  );
}

const curMonthIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; };

function MonthHistory({ person, boardOrder }: { person: Person; boardOrder: string[] }) {
  const [selected, setSelected] = useState(curMonthIso());
  const [picking, setPicking] = useState(false);
  const [year, setYear] = useState(Number(selected.substring(0, 4)));
  useEffect(() => { setSelected(curMonthIso()); setPicking(false); }, [person.userId]);
  const byMonth = useMemo(() => new Map(person.months.map((m) => [m.month.substring(0, 7), m])), [person.months]);
  const years = useMemo(() => {
    const ys = new Set<number>([new Date().getFullYear(), ...person.months.map((m) => Number(m.month.substring(0, 4)))]);
    return [...ys].sort((a, b) => b - a);
  }, [person.months]);
  const m = byMonth.get(selected.substring(0, 7));
  const isCurrent = selected === curMonthIso();

  if (picking) return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setPicking(false)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" />Voltar</button>
        <OpsLabel>Escolher mês</OpsLabel>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {years.map((y) => (
          <button key={y} type="button" onClick={() => setYear(y)}
            className={`h-8 rounded-full border px-3 text-xs font-medium tabular-nums ${y === year ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary"}`}>{y}</button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 12 }, (_, i) => {
          const key = `${year}-${String(i + 1).padStart(2, "0")}`;
          const d = byMonth.get(key);
          const active = selected.substring(0, 7) === key;
          const name = new Date(year, i, 15).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
          return (
            <button key={key} type="button" onClick={() => { setSelected(`${key}-01`); setPicking(false); }}
              className={`rounded-xl border p-2.5 text-left transition-colors ${active ? "border-primary bg-primary/5" : "hover:border-primary"}`}>
              <p className="font-ops-label text-xs uppercase">{name}</p>
              <p className="text-[11px] text-muted-foreground tabular-nums">{d ? hrs(d.hours) : "sem registros"}</p>
              {d && d.cost == null && d.hours > 0 && <p className="text-[11px] text-primary">sem custo</p>}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center justify-between">
        <OpsLabel>{isCurrent ? "Mês atual" : "Mês selecionado"} · {monthLabel(selected)}</OpsLabel>
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 rounded-full" onClick={() => { setYear(Number(selected.substring(0, 4))); setPicking(true); }}>
          <CalendarDays className="h-4 w-4" />Ver outros meses
        </Button>
      </div>
      {m ? <MonthCard m={m} boardOrder={boardOrder} /> : (
        <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">Sem horas ou custos registrados em {monthLabel(selected)}.</div>
      )}
      {!isCurrent && <button type="button" onClick={() => setSelected(curMonthIso())} className="text-xs text-primary hover:underline">Voltar ao mês atual</button>}
    </div>
  );
}

function MonthCard({ m, boardOrder }: { m: Person["months"][number]; boardOrder: string[] }) {
  const cph = m.cost != null && m.ref ? costPerHour(m.cost, m.ref) : null;
  const occ = m.ref ? m.hours / m.ref : null;
  const spent = m.boards.reduce((s, b) => s + (b.cost ?? 0), 0);
  return (
    <div className="rounded-xl border p-3 space-y-2 text-sm">
      <div className="grid grid-cols-3 gap-2">
        <div><p className="text-[11px] text-muted-foreground">Custo mensal</p><p className="tabular-nums font-medium">{m.cost == null ? <span className="text-primary">sem custo</span> : formatBRL(m.cost)}</p></div>
        <div><p className="text-[11px] text-muted-foreground">Hora/homem</p><p className="tabular-nums font-medium">{cph == null ? "—" : formatBRL(cph)}</p></div>
        <div><p className="text-[11px] text-muted-foreground">Apontadas / ref.</p><p className="tabular-nums font-medium">{hrs(m.hours)} / {m.ref ? hrs(m.ref) : "—"}</p></div>
      </div>
      <div className="flex items-center gap-2"><OccupancyRuler value={occ} /><span className="tabular-nums text-xs w-10 text-right">{occ == null ? "—" : `${Math.round(occ * 100)}%`}</span></div>
      {m.boards.length === 0 ? <p className="text-xs text-muted-foreground">Sem horas no mês</p> : (
        <div className="space-y-1.5">
          {m.cost != null && <AllocationBar total={spent} order={boardOrder} parts={m.boards.map((b) => ({ key: b.board_id!, label: `${b.board_name} · ${hrs(b.hours)}`, amount: b.cost ?? 0 }))} />}
          <ul className="text-xs space-y-0.5">{m.boards.map((b) => (
            <li key={b.board_id} className="flex justify-between gap-2"><span className="truncate">{b.board_name}</span><span className="tabular-nums text-muted-foreground">{hrs(b.hours)}{b.cost != null ? ` · ${formatBRL(b.cost)}` : ""}</span></li>
          ))}</ul>
        </div>
      )}
    </div>
  );
}
