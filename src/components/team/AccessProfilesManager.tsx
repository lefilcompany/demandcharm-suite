import { useMemo, useState } from "react";
import { KeyRound, Loader2, Plus, Search, Trash2, Pencil } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/hooks/useTeamMembers";
import { MemberKindBadge } from "./MemberKindBadge";
import {
  MODULES, MEMBER_KIND_LABEL, financeBlocked, hasFinance, type AccessProfile, type MemberKind,
} from "@/lib/access/profiles";

interface Assignment { id: string; user_id: string; profile_id: string; all_projects: boolean; member_access_project_scope: { project_id: string }[] }

const ERR: Record<string, string> = {
  CANNOT_GRANT_SELF: "Você não pode alterar o próprio acesso.",
  USER_NOT_IN_TEAM: "Essa pessoa não faz mais parte da equipe.",
  FORBIDDEN: "Só o dono da equipe pode alterar acessos.",
  FINANCE_NOT_ALLOWED_FOR_MEMBER: "Solicitantes e externos do cliente não podem ver o financeiro.",
  REMOVE_FINANCE_PROFILE_FIRST: "Tire o perfil com finanças antes de marcar como externo do cliente.",
  PROFILE_IN_USE: "Esse perfil ainda está em uso por alguém.",
  NAME_REQUIRED: "Dê um nome ao perfil.",
};
const errMsg = (e: any) => ERR[Object.keys(ERR).find((k) => String(e?.message).includes(k)) ?? ""] ?? "Não foi possível salvar.";

export function AccessProfilesManager({ teamId, members, currentUserId }: { teamId: string; members: TeamMember[]; currentUserId?: string }) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | "internal" | "external">("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<AccessProfile> | null>(null);

  const key = ["access-profiles", teamId, currentUserId];
  const data = useQuery({
    queryKey: key,
    queryFn: async () => {
      const [p, a, pr] = await Promise.all([
        supabase.from("access_profiles").select("*").or(`team_id.is.null,team_id.eq.${teamId}`).order("is_system", { ascending: false }).order("name"),
        supabase.from("member_access_profiles").select("id,user_id,profile_id,all_projects,member_access_project_scope(project_id)").eq("team_id", teamId),
        supabase.from("projects").select("id,name").eq("team_id", teamId).order("name"),
      ]);
      if (p.error) throw p.error; if (a.error) throw a.error; if (pr.error) throw pr.error;
      return { profiles: p.data as AccessProfile[], assignments: a.data as unknown as Assignment[], projects: pr.data as { id: string; name: string }[] };
    },
  });
  const profiles = data.data?.profiles ?? [];
  const byUser = useMemo(() => new Map((data.data?.assignments ?? []).map((a) => [a.user_id, a])), [data.data]);
  const noneId = profiles.find((p) => p.system_key === "none")?.id;

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ["access-profiles", teamId] });
    qc.invalidateQueries({ queryKey: ["team-members", teamId] });
    qc.invalidateQueries({ queryKey: ["finance"] });
  };
  async function run(id: string, fn: () => PromiseLike<{ error: any }>, ok: string) {
    setBusy(id);
    try { const { error } = await fn(); if (error) throw error; toast.success(ok); }
    catch (e) { toast.error(errMsg(e)); }
    finally { await refresh(); setBusy(null); }
  }
  const assign = (userId: string, profileId: string, all: boolean, projectIds: string[]) =>
    run(userId, () => supabase.rpc("assign_access_profile", { _team_id: teamId, _user_id: userId, _profile_id: profileId, _all_projects: all, _project_ids: projectIds }), "Acesso atualizado");
  const setKind = (userId: string, kind: MemberKind) =>
    run(userId, () => supabase.rpc("set_member_kind", { _team_id: teamId, _user_id: userId, _kind: kind }), "Tipo atualizado");

  const people = members
    .filter((m) => kindFilter === "all" || (kindFilter === "internal" ? m.member_kind === "internal" : m.member_kind !== "internal"))
    .filter((m) => !q || `${m.profile.full_name} ${m.profile.email ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  async function saveProfile() {
    if (!editing) return;
    await run("profile", () => supabase.rpc("upsert_access_profile", {
      _team_id: teamId, _id: editing.id ?? null, _name: editing.name ?? "", _description: editing.description ?? "", _permissions: editing.permissions ?? [],
    }), "Perfil salvo");
    setEditing(null);
  }

  return (
    <section className="lg:col-span-2 rounded-xl border bg-card shadow-xl overflow-hidden">
      <header className="bg-ops-ink text-ops-ink-foreground px-5 py-4">
        <p className="font-ops-label text-[10px] uppercase tracking-[0.2em] text-ops-muted flex items-center gap-1.5"><KeyRound className="h-3 w-3" /> Perfis de acesso</p>
        <h2 className="font-ops-display text-2xl font-semibold uppercase tracking-wide leading-tight">O que cada pessoa acessa na equipe</h2>
        <p className="text-xs text-ops-muted mt-1 max-w-xl">Aqui você define os módulos (Finanças, Projetos, Relatórios). O que a pessoa faz nas demandas continua definido pelo papel em cada quadro.</p>
      </header>

      {data.isError ? (
        <div className="p-6 text-sm text-center">Não foi possível carregar os acessos. <button className="underline text-primary" onClick={() => data.refetch()}>Tentar de novo</button></div>
      ) : data.isLoading ? (
        <div className="p-6 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : (
        <>
          <div className="px-5 py-4 border-b">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Perfis</h3>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setEditing({ name: "", permissions: [] })}><Plus className="h-3.5 w-3.5 mr-1" /> Novo perfil</Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {profiles.map((p) => {
                const used = (data.data?.assignments ?? []).filter((a) => a.profile_id === p.id).length;
                return (
                  <div key={p.id} className="rounded-lg border px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate flex-1">{p.name}</span>
                      {p.is_system ? <span className="text-[10px] text-muted-foreground">Padrão</span> : (
                        <>
                          <button aria-label="Editar perfil" onClick={() => setEditing(p)} className="text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                          <button aria-label="Apagar perfil" disabled={used > 0} title={used ? "Em uso" : "Apagar"}
                            onClick={() => run("profile", () => supabase.rpc("delete_access_profile", { _id: p.id }), "Perfil apagado")}
                            className="text-muted-foreground hover:text-destructive disabled:opacity-40"><Trash2 className="h-3.5 w-3.5" /></button>
                        </>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-0.5 line-clamp-2">{p.description || `${p.permissions.length} permissões`}</p>
                    <p className="text-muted-foreground mt-1">{used} pessoa{used === 1 ? "" : "s"}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-5 py-3 border-b flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pessoa" className="h-8 pl-8" />
            </div>
            <div role="radiogroup" aria-label="Filtrar por tipo" className="flex rounded-md border p-0.5">
              {([["all", "Todos"], ["internal", "Internos"], ["external", "Externos"]] as const).map(([k, l]) => (
                <button key={k} role="radio" aria-checked={kindFilter === k} onClick={() => setKindFilter(k)}
                  className={cn("px-2.5 h-7 text-xs rounded-sm", kindFilter === k ? "bg-primary text-primary-foreground font-medium" : "text-muted-foreground hover:text-foreground")}>{l}</button>
              ))}
            </div>
          </div>

          {people.length === 0 ? (
            <p className="p-6 text-sm text-center text-muted-foreground">Ninguém encontrado.</p>
          ) : (
            <ul className="divide-y">
              {people.map((m) => {
                const a = byUser.get(m.user_id);
                const isMe = m.user_id === currentUserId;
                const blocked = financeBlocked(m.role as string, m.member_kind);
                const scope = a?.member_access_project_scope.map((s) => s.project_id) ?? [];
                const isBusy = busy === m.user_id;
                return (
                  <li key={m.user_id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                    <Avatar className="h-8 w-8"><AvatarImage src={m.profile.avatar_url ?? undefined} /><AvatarFallback className="text-xs">{m.profile.full_name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback></Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate flex items-center gap-1.5">{m.profile.full_name}<MemberKindBadge kind={m.member_kind} />{isMe && <span className="text-muted-foreground text-xs">(você)</span>}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{m.profile.email}</p>
                    </div>
                    <Select value={m.member_kind} disabled={isBusy} onValueChange={(v) => setKind(m.user_id, v as MemberKind)}>
                      <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Tipo de membro"><SelectValue /></SelectTrigger>
                      <SelectContent>{(Object.keys(MEMBER_KIND_LABEL) as MemberKind[]).map((k) => <SelectItem key={k} value={k}>{MEMBER_KIND_LABEL[k]}</SelectItem>)}</SelectContent>
                    </Select>
                    <Select value={a?.profile_id ?? noneId} disabled={isBusy || isMe}
                      onValueChange={(v) => assign(m.user_id, v, a?.all_projects ?? true, scope)}>
                      <SelectTrigger className="h-8 w-[180px] text-xs" aria-label="Perfil de acesso"><SelectValue placeholder="Sem acesso" /></SelectTrigger>
                      <SelectContent>
                        {profiles.map((p) => (
                          <SelectItem key={p.id} value={p.id} disabled={!!blocked && hasFinance(p.permissions)}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs" disabled={!a || isBusy || isMe || a.profile_id === noneId}>
                          {!a || a.all_projects ? "Todos os projetos" : `${scope.length} projeto${scope.length === 1 ? "" : "s"}`}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3 text-xs" align="end">
                        <label className="flex items-center gap-2 py-1 font-medium">
                          <Checkbox checked={a?.all_projects ?? true} onCheckedChange={(c) => a && assign(m.user_id, a.profile_id, !!c, scope)} /> Todos os projetos
                        </label>
                        <div className="mt-1 max-h-56 overflow-y-auto border-t pt-1">
                          {(data.data?.projects ?? []).map((p) => {
                            const on = scope.includes(p.id);
                            return (
                              <label key={p.id} className={cn("flex items-center gap-2 py-1", a?.all_projects && "opacity-50")}>
                                <Checkbox checked={on} disabled={a?.all_projects}
                                  onCheckedChange={() => a && assign(m.user_id, a.profile_id, false, on ? scope.filter((x) => x !== p.id) : [...scope, p.id])} />
                                <span className="truncate">{p.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                    {isBusy && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
                    {blocked && <p className="basis-full pl-11 text-[11px] text-muted-foreground">{blocked}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar perfil" : "Novo perfil"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome do perfil" value={editing?.name ?? ""} onChange={(e) => setEditing({ ...editing!, name: e.target.value })} />
            <Input placeholder="Descrição (opcional)" value={editing?.description ?? ""} onChange={(e) => setEditing({ ...editing!, description: e.target.value })} />
            <div className="grid gap-4 sm:grid-cols-3">
              {MODULES.map((mod) => (
                <fieldset key={mod.key}>
                  <legend className="font-ops-label text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">{mod.title}</legend>
                  {mod.items.map(({ p, label }) => {
                    const on = editing?.permissions?.includes(p) ?? false;
                    return (
                      <label key={p} className="flex items-center gap-2 py-1 text-xs cursor-pointer">
                        <Checkbox checked={on} onCheckedChange={() => setEditing({ ...editing!, permissions: on ? editing!.permissions!.filter((x) => x !== p) : [...(editing!.permissions ?? []), p] })} />
                        {label}
                      </label>
                    );
                  })}
                </fieldset>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={saveProfile} disabled={busy === "profile"}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
