import { useMemo, useState } from "react";
import { ChevronDown, KeyRound, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FinancePermission, PERMISSION_LABELS } from "@/hooks/useFinance";
import { AccessPreset, PRESETS, PERMISSION_GROUPS, detectPreset, diffPermissions } from "@/lib/finance/accessPresets";
import type { TeamMember } from "@/hooks/useTeamMembers";

interface Grant { id: string; user_id: string; permission: FinancePermission; board_id: string | null }

const ERR: Record<string, string> = {
  CANNOT_GRANT_SELF: "Você não pode alterar o próprio acesso.",
  USER_NOT_IN_TEAM: "Essa pessoa não faz mais parte da equipe.",
  FORBIDDEN: "Só o dono da equipe pode alterar acessos.",
};
const errMsg = (e: any) => ERR[Object.keys(ERR).find((k) => String(e?.message).includes(k)) ?? ""] ?? "Não foi possível salvar o acesso.";

export function FinanceAccessManager({ teamId, members, currentUserId }: { teamId: string; members: TeamMember[]; currentUserId?: string }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const grants = useQuery({
    queryKey: ["finance-access", teamId, currentUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from("finance_permissions").select("id,user_id,permission,board_id")
        .eq("team_id", teamId).is("revoked_at", null);
      if (error) throw error;
      return (data ?? []) as Grant[];
    },
  });

  const byUser = useMemo(() => {
    const m = new Map<string, Grant[]>();
    (grants.data ?? []).forEach((g) => m.set(g.user_id, [...(m.get(g.user_id) ?? []), g]));
    return m;
  }, [grants.data]);

  const people = members
    .filter((m) => m.user_id !== currentUserId)
    .filter((m) => !q || `${m.profile.full_name} ${m.profile.email ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  const withAccess = members.filter((m) => m.user_id !== currentUserId && (byUser.get(m.user_id) ?? []).some((g) => !g.board_id)).length;

  async function apply(userId: string, target: FinancePermission[]) {
    const teamWide = (byUser.get(userId) ?? []).filter((g) => !g.board_id);
    const { grant, revoke } = diffPermissions(teamWide.map((g) => g.permission), target);
    if (!grant.length && !revoke.length) return;
    setBusy(userId);
    try {
      for (const p of grant) {
        const { error } = await supabase.rpc("grant_finance_permission", { _team_id: teamId, _user_id: userId, _permission: p, _board_id: null });
        if (error) throw error;
      }
      for (const p of revoke) {
        const id = teamWide.find((g) => g.permission === p)!.id;
        const { error } = await supabase.rpc("revoke_finance_permission", { _permission_id: id });
        if (error) throw error;
      }
      toast.success("Acesso atualizado");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      await qc.invalidateQueries({ queryKey: ["finance-access", teamId] });
      qc.invalidateQueries({ queryKey: ["finance"] });
      setBusy(null);
    }
  }

  return (
    <section className="lg:col-span-2 rounded-xl border bg-card shadow-xl overflow-hidden">
      <header className="bg-ops-ink text-ops-ink-foreground px-5 py-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-ops-label text-[10px] uppercase tracking-[0.2em] text-ops-muted flex items-center gap-1.5">
            <KeyRound className="h-3 w-3" /> Acesso ao financeiro
          </p>
          <h2 className="font-ops-display text-2xl font-semibold uppercase tracking-wide leading-tight">Quem vê os números da equipe</h2>
          <p className="text-xs text-ops-muted mt-1 max-w-md">Ninguém recebe acesso sozinho. Escolha um nível para cada pessoa; toda mudança fica registrada.</p>
        </div>
        <div className="text-right">
          <span className="font-ops-display text-4xl font-semibold text-primary leading-none">{withAccess}</span>
          <span className="font-ops-label text-[10px] uppercase text-ops-muted block">de {Math.max(members.length - 1, 0)} com acesso</span>
        </div>
      </header>

      <div className="px-5 py-3 border-b flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoa" className="h-8 pl-8" />
        </div>
        <dl className="hidden md:flex gap-4 text-[11px] text-muted-foreground">
          {(["reader", "analyst", "manager"] as AccessPreset[]).map((k) => (
            <div key={k}><dt className="inline font-semibold text-foreground">{PRESETS[k].label}:</dt> <dd className="inline">{PRESETS[k].hint}</dd></div>
          ))}
        </dl>
      </div>

      {grants.isError ? (
        <div className="p-6 text-sm text-center">
          Não foi possível carregar os acessos. <button className="underline text-primary" onClick={() => grants.refetch()}>Tentar de novo</button>
        </div>
      ) : grants.isLoading ? (
        <div className="p-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : people.length === 0 ? (
        <p className="p-6 text-sm text-center text-muted-foreground">{q ? "Ninguém encontrado com esse nome." : "Convide pessoas para a equipe para dar acesso."}</p>
      ) : (
        <ul className="divide-y">
          {people.map((m) => {
            const all = byUser.get(m.user_id) ?? [];
            const team = all.filter((g) => !g.board_id).map((g) => g.permission);
            const boardOnly = all.filter((g) => g.board_id).length;
            const preset = detectPreset(team);
            const isOpen = open === m.user_id;
            const isBusy = busy === m.user_id;
            return (
              <li key={m.user_id} className={cn("px-5 py-3", isOpen && "bg-muted/40")}>
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={m.profile.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">{m.profile.full_name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{m.profile.full_name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {preset === null ? `Personalizado · ${team.length} permiss${team.length === 1 ? "ão" : "ões"}` : PRESETS[preset].label}
                      {boardOnly > 0 && ` · +${boardOnly} em quadros específicos`}
                    </p>
                  </div>
                  <div role="radiogroup" aria-label={`Nível de acesso de ${m.profile.full_name}`} className="flex rounded-md border bg-background p-0.5">
                    {(Object.keys(PRESETS) as AccessPreset[]).map((k) => (
                      <button key={k} role="radio" aria-checked={preset === k} disabled={isBusy}
                        onClick={() => apply(m.user_id, PRESETS[k].perms)}
                        title={PRESETS[k].hint}
                        className={cn("px-2.5 h-7 text-xs rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                          preset === k ? (k === "none" ? "bg-muted text-foreground font-medium" : "bg-primary text-primary-foreground font-medium") : "text-muted-foreground hover:text-foreground")}>
                        {PRESETS[k].label}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setOpen(isOpen ? null : m.user_id)} aria-expanded={isOpen}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
                    Ajustar <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                </div>
                {isOpen && (
                  <div className="mt-3 grid gap-4 sm:grid-cols-3 pl-11">
                    {PERMISSION_GROUPS.map((g) => (
                      <fieldset key={g.title}>
                        <legend className="font-ops-label text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">{g.title}</legend>
                        {g.items.map((p) => {
                          const on = team.includes(p);
                          return (
                            <label key={p} className="flex items-center gap-2 py-1 text-xs cursor-pointer">
                              <Checkbox checked={on} disabled={isBusy}
                                onCheckedChange={() => apply(m.user_id, on ? team.filter((x) => x !== p) : [...team, p])} />
                              {PERMISSION_LABELS[p]}
                            </label>
                          );
                        })}
                      </fieldset>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
