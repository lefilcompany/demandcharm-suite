import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { OpsLabel } from "@/components/ops/OpsParts";
import { formatBRL, formatPct } from "@/lib/finance/engine";
import { FinancePermission, PERMISSION_LABELS, useFinanceMutation, useFinanceTable } from "@/hooks/useFinance";

interface Props {
  teamId: string;
  boards: { id: string; name: string }[];
  members: { user_id: string; name: string }[];
  can: (p: FinancePermission, boardId?: string) => boolean;
  canAny: (p: FinancePermission) => boolean;
  isOwnerOrAdmin: boolean;
}

const monthStart = (m: string) => `${m}-01`;
const ERR: Record<string, string> = {
  CANNOT_GRANT_SELF: "Você não pode dar permissões financeiras a si mesmo.",
  FORBIDDEN: "Você não tem autorização para gerenciar permissões desta equipe.",
  USER_NOT_IN_TEAM: "Essa pessoa não faz parte da equipe.",
  USER_NOT_ON_BOARD: "Essa pessoa não participa do quadro (ou é solicitante).",
};
const msg = (e: any) => Object.entries(ERR).find(([k]) => String(e?.message).includes(k))?.[1] ?? "Não foi possível salvar. Confira os campos e tente de novo.";

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-4">
      <div><h3 className="font-semibold">{title}</h3><p className="text-sm text-muted-foreground">{hint}</p></div>
      {children}
    </section>
  );
}

export function FinanceManage({ teamId, boards, members, can, canAny, isOwnerOrAdmin }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const thisMonth = new Date().toISOString().substring(0, 7);
  const boardName = (id: string | null) => (id ? boards.find((b) => b.id === id)?.name ?? "Quadro" : "Equipe toda");
  const memberName = (id: string) => members.find((m) => m.user_id === id)?.name ?? "Pessoa";
  const done = (t: string) => toast({ title: t });
  const fail = (e: any) => toast({ title: msg(e), variant: "destructive" });

  const revenues = useFinanceTable<any>("finance_revenues", teamId, canAny("finance.manage_revenue"));
  const expenses = useFinanceTable<any>("finance_expenses", teamId, canAny("finance.manage_expenses"));
  const costs = useFinanceTable<any>("finance_employee_costs", teamId, can("finance.view_employee_costs"));
  const perms = useFinanceTable<any>("finance_permissions", teamId, can("finance.manage_settings"));
  const settings = useFinanceTable<any>("finance_settings", teamId, can("finance.manage_settings"));

  const [rev, setRev] = useState({ board: "", month: thisMonth, amount: "", tax: "", description: "" });
  const [exp, setExp] = useState({ board: "", month: thisMonth, amount: "", description: "" });
  const [cost, setCost] = useState({ user: "", month: thisMonth, amount: "", hours: "140" });
  const [perm, setPerm] = useState<{ user: string; permission: FinancePermission | ""; board: string }>({ user: "", permission: "", board: "all" });
  const teamSetting = settings.data?.find((s) => !s.board_id);
  const [cfg, setCfg] = useState<{ tax: string; target: string } | null>(null);

  const addRev = useFinanceMutation(async () => {
    const { error } = await supabase.from("finance_revenues").insert({ team_id: teamId, board_id: rev.board, competence: monthStart(rev.month),
      gross_amount: Number(rev.amount), tax_rate: rev.tax ? Number(rev.tax) / 100 : null, description: rev.description || null, created_by: user!.id });
    if (error) throw error;
  });
  const addExp = useFinanceMutation(async () => {
    const { error } = await supabase.from("finance_expenses").insert({ team_id: teamId, board_id: exp.board, competence: monthStart(exp.month),
      amount: Number(exp.amount), description: exp.description, created_by: user!.id });
    if (error) throw error;
  });
  const addCost = useFinanceMutation(async () => {
    const { error } = await supabase.from("finance_employee_costs").upsert({ team_id: teamId, user_id: cost.user, competence: monthStart(cost.month),
      monthly_cost: Number(cost.amount), productive_hours: Number(cost.hours), created_by: user!.id }, { onConflict: "team_id,user_id,competence" });
    if (error) throw error;
  });
  const del = useFinanceMutation(async ({ table, id }: { table: "finance_revenues" | "finance_expenses" | "finance_employee_costs"; id: string }) => {
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) throw error;
  });
  const grant = useFinanceMutation(async () => {
    const { error } = await supabase.rpc("grant_finance_permission", { _team_id: teamId, _user_id: perm.user, _permission: perm.permission,
      _board_id: perm.board === "all" ? null : perm.board });
    if (error) throw error;
  });
  const revoke = useFinanceMutation(async (id: string) => {
    const { error } = await supabase.rpc("revoke_finance_permission", { _permission_id: id });
    if (error) throw error;
  });
  const saveCfg = useFinanceMutation(async () => {
    const tax = Number(cfg!.tax) / 100, target = Number(cfg!.target) / 100;
    const q = teamSetting
      ? supabase.from("finance_settings").update({ tax_rate: tax, margin_target: target, updated_by: user!.id, updated_at: new Date().toISOString() }).eq("id", teamSetting.id)
      : supabase.from("finance_settings").insert({ team_id: teamId, tax_rate: tax, margin_target: target, updated_by: user!.id });
    const { error } = await q;
    if (error) throw error;
  });

  const revBoards = boards.filter((b) => can("finance.manage_revenue", b.id));
  const expBoards = boards.filter((b) => can("finance.manage_expenses", b.id));

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {revBoards.length > 0 && (
        <Section title="Faturamento" hint="Valor bruto faturado por quadro no mês. Deixe a alíquota vazia para usar a padrão.">
          <form className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end" onSubmit={(e) => { e.preventDefault(); addRev.mutate(undefined, { onSuccess: () => { done("Faturamento lançado"); setRev({ ...rev, amount: "", description: "" }); }, onError: fail }); }}>
            <BoardPick boards={revBoards} value={rev.board} onChange={(v) => setRev({ ...rev, board: v })} />
            <Field label="Mês"><Input type="month" value={rev.month} onChange={(e) => setRev({ ...rev, month: e.target.value })} required /></Field>
            <Field label="Valor (R$)"><Input type="number" min="0" step="0.01" value={rev.amount} onChange={(e) => setRev({ ...rev, amount: e.target.value })} required /></Field>
            <Field label="Alíquota %"><Input type="number" min="0" max="99" step="0.01" placeholder="padrão" value={rev.tax} onChange={(e) => setRev({ ...rev, tax: e.target.value })} /></Field>
            <Button type="submit" disabled={!rev.board || addRev.isPending}>Lançar</Button>
          </form>
          <Rows items={revenues.data} render={(r) => `${boardName(r.board_id)} · ${r.competence.substring(0, 7)} · ${formatBRL(Number(r.gross_amount))}${r.tax_rate != null ? ` · ${formatPct(Number(r.tax_rate))}` : ""}`}
            onDelete={(r) => del.mutate({ table: "finance_revenues", id: r.id }, { onSuccess: () => done("Lançamento removido"), onError: fail })} canDelete={(r) => can("finance.manage_revenue", r.board_id)} />
        </Section>
      )}

      {expBoards.length > 0 && (
        <Section title="Despesas diretas" hint="Gastos que pertencem a um só quadro, como uma licença usada só nesse projeto.">
          <form className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end" onSubmit={(e) => { e.preventDefault(); addExp.mutate(undefined, { onSuccess: () => { done("Despesa lançada"); setExp({ ...exp, amount: "", description: "" }); }, onError: fail }); }}>
            <BoardPick boards={expBoards} value={exp.board} onChange={(v) => setExp({ ...exp, board: v })} />
            <Field label="Mês"><Input type="month" value={exp.month} onChange={(e) => setExp({ ...exp, month: e.target.value })} required /></Field>
            <Field label="Descrição"><Input value={exp.description} onChange={(e) => setExp({ ...exp, description: e.target.value })} required /></Field>
            <Field label="Valor (R$)"><Input type="number" min="0" step="0.01" value={exp.amount} onChange={(e) => setExp({ ...exp, amount: e.target.value })} required /></Field>
            <Button type="submit" disabled={!exp.board || addExp.isPending}>Lançar</Button>
          </form>
          <Rows items={expenses.data} render={(r) => `${boardName(r.board_id)} · ${r.competence.substring(0, 7)} · ${r.description} · ${formatBRL(Number(r.amount))}`}
            onDelete={(r) => del.mutate({ table: "finance_expenses", id: r.id }, { onSuccess: () => done("Despesa removida"), onError: fail })} canDelete={(r) => can("finance.manage_expenses", r.board_id)} />
        </Section>
      )}

      {can("finance.view_employee_costs") && (
        <Section title="Custo das pessoas" hint="Custo mensal completo (salário, encargos, benefícios, férias, 13º) e horas produtivas do mês. O custo/hora sai da divisão.">
          {can("finance.manage_settings") && (
            <form className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end" onSubmit={(e) => { e.preventDefault(); addCost.mutate(undefined, { onSuccess: () => { done("Custo salvo"); setCost({ ...cost, amount: "" }); }, onError: fail }); }}>
              <Field label="Pessoa"><Select value={cost.user} onValueChange={(v) => setCost({ ...cost, user: v })}><SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>{members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Mês"><Input type="month" value={cost.month} onChange={(e) => setCost({ ...cost, month: e.target.value })} required /></Field>
              <Field label="Custo mensal (R$)"><Input type="number" min="0" step="0.01" value={cost.amount} onChange={(e) => setCost({ ...cost, amount: e.target.value })} required /></Field>
              <Field label="Horas produtivas"><Input type="number" min="1" step="1" value={cost.hours} onChange={(e) => setCost({ ...cost, hours: e.target.value })} required /></Field>
              <Button type="submit" disabled={!cost.user || addCost.isPending}>Salvar</Button>
            </form>
          )}
          <Rows items={costs.data} render={(r) => `${memberName(r.user_id)} · ${r.competence.substring(0, 7)} · ${formatBRL(Number(r.monthly_cost))} · ${formatBRL(Number(r.monthly_cost) / Number(r.productive_hours))}/h`}
            onDelete={(r) => del.mutate({ table: "finance_employee_costs", id: r.id }, { onSuccess: () => done("Custo removido"), onError: fail })} canDelete={() => can("finance.manage_settings")} />
        </Section>
      )}

      {can("finance.manage_settings") && (
        <Section title="Metas e alíquota" hint="Valem para a equipe toda. A meta é comparada com a margem realizada, não entra como custo.">
          <form className="grid grid-cols-3 gap-2 items-end" onSubmit={(e) => { e.preventDefault(); saveCfg.mutate(undefined, { onSuccess: () => done("Configuração salva"), onError: fail }); }}>
            <Field label="Alíquota padrão %"><Input type="number" min="0" max="99" step="0.01" value={cfg?.tax ?? String(Number(teamSetting?.tax_rate ?? 0.21) * 100)} onChange={(e) => setCfg({ tax: e.target.value, target: cfg?.target ?? String(Number(teamSetting?.margin_target ?? 0.4) * 100) })} /></Field>
            <Field label="Meta de margem %"><Input type="number" min="-99" max="99" step="0.1" value={cfg?.target ?? String(Number(teamSetting?.margin_target ?? 0.4) * 100)} onChange={(e) => setCfg({ target: e.target.value, tax: cfg?.tax ?? String(Number(teamSetting?.tax_rate ?? 0.21) * 100) })} /></Field>
            <Button type="submit" disabled={!cfg || saveCfg.isPending}>Salvar</Button>
          </form>
        </Section>
      )}

      {can("finance.manage_settings") && isOwnerOrAdmin && (
        <Section title="Quem acessa os números" hint="Ninguém recebe acesso automático. Você não pode dar permissões a si mesmo; toda concessão fica registrada.">
          <form className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end" onSubmit={(e) => { e.preventDefault(); grant.mutate(undefined, { onSuccess: () => done("Permissão concedida"), onError: fail }); }}>
            <Field label="Pessoa"><Select value={perm.user} onValueChange={(v) => setPerm({ ...perm, user: v })}><SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
              <SelectContent>{members.filter((m) => m.user_id !== user?.id).map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Permissão"><Select value={perm.permission} onValueChange={(v) => setPerm({ ...perm, permission: v as FinancePermission })}><SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
              <SelectContent>{Object.entries(PERMISSION_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Onde"><Select value={perm.board} onValueChange={(v) => setPerm({ ...perm, board: v })}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Equipe toda</SelectItem>{boards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></Field>
            <Button type="submit" disabled={!perm.user || !perm.permission || grant.isPending}>Conceder</Button>
          </form>
          <Rows items={perms.data} render={(r) => `${memberName(r.user_id)} · ${PERMISSION_LABELS[r.permission as FinancePermission]} · ${boardName(r.board_id)}`}
            onDelete={(r) => revoke.mutate(r.id, { onSuccess: () => done("Permissão revogada"), onError: fail })} canDelete={() => true} deleteLabel="Revogar" />
        </Section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1 min-w-0"><Label className="text-xs">{label}</Label>{children}</div>;
}

function BoardPick({ boards, value, onChange }: { boards: { id: string; name: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <Field label="Quadro"><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
      <SelectContent>{boards.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></Field>
  );
}

function Rows({ items, render, onDelete, canDelete, deleteLabel = "Remover" }: { items?: any[]; render: (r: any) => string; onDelete: (r: any) => void; canDelete: (r: any) => boolean; deleteLabel?: string }) {
  if (!items?.length) return <OpsLabel>Nada lançado ainda</OpsLabel>;
  return (
    <ul className="divide-y max-h-64 overflow-y-auto text-sm">
      {items.slice(0, 50).map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-2 py-2">
          <span className="truncate tabular-nums">{render(r)}</span>
          {canDelete(r) && (
            <Button variant="ghost" size="sm" className="h-7 shrink-0" onClick={() => onDelete(r)} aria-label={deleteLabel}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
