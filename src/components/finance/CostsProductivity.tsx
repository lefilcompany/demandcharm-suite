import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, AlertCircle, Info, ChevronRight, RefreshCw, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFinanceMutation } from "@/hooks/useFinance";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { PeopleRow } from "@/hooks/useFinance";
import { OpsLabel } from "@/components/ops/OpsParts";
import { AllocationBar, OccupancyRuler } from "@/components/finance/AllocationBar";
import { costPerHour, formatBRL, formatPct } from "@/lib/finance/engine";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const hrs = (h: number) => `${h.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
const monthLabel = (iso: string) => new Date(`${iso.substring(0, 10)}T12:00:00`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

export function CostsProductivity({ rows, detailed, isLoading, isError, onRetry, boardOrder, teamId, canEdit }: {
  rows: PeopleRow[]; detailed: boolean; isLoading: boolean; isError: boolean; onRetry: () => void; boardOrder: string[];
  teamId: string | null; canEdit: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
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
    return [...m.values()].sort((a, b) => Number(hasGap(b)) - Number(hasGap(a)) || a.name.localeCompare(b.name));
  }, [people]);
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
          {missing.length > 0 && <Alert title={`${missing.length} sem custo no mês`} body={`As horas de ${missing.map((p) => p.name.split(" ")[0]).slice(0, 3).join(", ")} não entram no custo. Clique no cartão da pessoa para cadastrar.`} tone="danger" />}
          {over.length > 0 && <Alert title={`${over.length} acima de 100%`} body="Apontaram mais horas que a referência do mês. Confira as horas produtivas ou a carga." tone="warn" />}
          {under.length > 0 && <Alert title={`${under.length} abaixo de 50%`} body="Pouco tempo apontado. Pode ser timer esquecido ou capacidade livre." tone="info" />}
        </ul>
      )}

      {detailed && (
        people.length === 0
          ? <p className="rounded-xl border p-6 text-center text-sm text-muted-foreground">Ninguém apontou horas nem tem custo cadastrado no período.</p>
          : <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(250px,1fr))]">
              {persons.map((p) => <PersonCard key={p.userId} p={p} onOpen={() => setOpenId(p.userId)} />)}
            </div>
      )}

      <PersonSheet person={persons.find((p) => p.userId === openId) ?? null} onClose={() => setOpenId(null)}
        teamId={teamId} canEdit={canEdit} boardOrder={boardOrder} />

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

function PersonCard({ p, onOpen }: { p: Person; onOpen: () => void }) {
  const last = p.months[0];
  const priced = p.months.find((m) => m.cost != null && m.ref);
  const cph = priced ? costPerHour(priced.cost!, priced.ref!) : null;
  const hours = p.months.reduce((s, m) => s + m.hours, 0);
  const occ = last.ref ? last.hours / last.ref : null;
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
          : <p className="font-ops-display text-2xl font-semibold tabular-nums">{formatBRL(cph)}<span className="text-xs font-normal text-muted-foreground"> /h · {monthLabel(priced!.month)}</span></p>}
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground"><span>Ocupação · {monthLabel(last.month)}</span><span className="tabular-nums">{occ == null ? "—" : `${Math.round(occ * 100)}%`}</span></div>
        <OccupancyRuler value={occ} />
      </div>
      {gap && <p className="text-xs text-primary">Há horas sem custo — clique para cadastrar.</p>}
    </button>
  );
}

const thisMonth = () => new Date().toISOString().substring(0, 7);

function PersonSheet({ person, onClose, teamId, canEdit, boardOrder }: {
  person: Person | null; onClose: () => void; teamId: string | null; canEdit: boolean; boardOrder: string[];
}) {
  const { user } = useAuth();
  const [form, setForm] = useState({ month: thisMonth(), amount: "", hours: "" });
  const pick = (month: string) => {
    const m = person?.months.find((x) => x.month.substring(0, 7) === month);
    const prev = person?.months.find((x) => x.cost != null);
    setForm({ month, amount: m?.cost != null ? String(m.cost) : "", hours: String(m?.ref ?? prev?.ref ?? 160) });
  };
  useEffect(() => {
    if (!person) return;
    const gap = person.months.find((m) => m.cost == null && m.hours > 0);
    pick((gap ?? person.months[0]).month.substring(0, 7));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person?.userId]);

  const save = useFinanceMutation(async () => {
    const { error } = await supabase.from("finance_employee_costs").upsert({ team_id: teamId!, user_id: person!.userId, competence: `${form.month}-01`,
      monthly_cost: Number(form.amount), productive_hours: Number(form.hours), created_by: user!.id }, { onConflict: "team_id,user_id,competence" });
    if (error) throw error;
  });
  const amount = Number(form.amount), hours = Number(form.hours);
  const preview = amount > 0 && hours > 0 ? amount / hours : null;
  const valid = !!form.month && amount > 0 && hours > 0 && hours <= 744;

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
              onSuccess: () => toast.success("Custo salvo"), onError: (err: any) => toast.error(err?.message ?? "Não foi possível salvar o custo") }); }}>
              <p className="font-semibold text-sm">Configurar hora/homem</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1"><Label htmlFor="pc-month">Mês</Label>
                  <Input id="pc-month" type="month" value={form.month} onChange={(e) => pick(e.target.value)} /></div>
                <div className="space-y-1"><Label htmlFor="pc-amount">Custo mensal (R$)</Label>
                  <Input id="pc-amount" type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div className="space-y-1"><Label htmlFor="pc-hours">Horas produtivas</Label>
                  <Input id="pc-hours" type="number" min="1" max="744" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} /></div>
              </div>
              <div className="flex items-end justify-between gap-3 rounded-lg bg-muted px-3 py-2">
                <div><OpsLabel>Hora/homem</OpsLabel><p className="font-ops-display text-xl font-semibold tabular-nums">{preview == null ? "—" : formatBRL(preview)}</p></div>
                <Button type="submit" size="sm" disabled={!valid || save.isPending} className="gap-1.5"><Save className="h-4 w-4" />Salvar custo</Button>
              </div>
            </form>
          ) : <p className="mt-5 text-xs text-muted-foreground rounded-lg border px-3 py-2">Para alterar a hora/homem é preciso a permissão "Gerenciar configurações".</p>}

          <div className="mt-5 space-y-3">
            <OpsLabel>Mês a mês</OpsLabel>
            {person.months.map((m) => {
              const cph = m.cost != null && m.ref ? costPerHour(m.cost, m.ref) : null;
              const occ = m.ref ? m.hours / m.ref : null;
              const spent = m.boards.reduce((s, b) => s + (b.cost ?? 0), 0);
              return (
                <div key={m.month} className="rounded-xl border p-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-ops-label text-xs uppercase">{monthLabel(m.month)}</span>
                    {canEdit && <button type="button" className="text-xs text-primary hover:underline" onClick={() => pick(m.month.substring(0, 7))}>Editar</button>}
                  </div>
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
            })}
          </div>
        </>)}
      </SheetContent>
    </Sheet>
  );
}
