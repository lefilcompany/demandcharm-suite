import { useMemo, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, FolderKanban, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Finance from "@/pages/Finance";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

type Scope = { kind: "project" | "unlinked"; scope_id: string; name: string; team_id: string; team_name: string; board_ids: string[]; finance_enabled: boolean };

export default function AdminFinance() {
  const { data: scopes = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-finance-scopes"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("admin_finance_scopes");
      if (error) throw error;
      return (data ?? []) as Scope[];
    },
  });
  const [teamId, setTeamId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const PAGE = 12;
  const list = useMemo(() => [...scopes].sort((a, b) =>
    (a.kind === b.kind ? 0 : a.kind === "project" ? -1 : 1) || Number(b.finance_enabled) - Number(a.finance_enabled) || a.name.localeCompare(b.name)), [scopes]);
  const key = (t: Scope) => `${t.kind}:${t.scope_id}`;
  const team = list.find((t) => key(t) === teamId);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? list.filter((t) => `${t.name} ${t.team_name}`.toLowerCase().includes(s)) : list;
  }, [list, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const visible = filtered.slice(cur * PAGE, cur * PAGE + PAGE);

  if (teamId) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setTeamId(null)} className="h-8 gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Trocar projeto
          </Button>
          <span className="font-ops-label text-[11px] uppercase tracking-widest text-muted-foreground">{team?.kind === "project" ? "Projeto" : "Quadros sem projeto"}</span>
          <span className="truncate text-sm font-semibold">{team?.kind === "project" ? team?.name : team?.team_name}</span>
          <span className="truncate text-xs text-muted-foreground">· {team?.team_name}</span>
        </div>
        {team && <Finance key={teamId} teamId={team.team_id} teamName={team.team_name} boardScope={team.board_ids} />}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="rounded-xl bg-ops-ink p-5 text-ops-ink-foreground shadow-xl md:p-7">
        <p className="font-ops-label text-[11px] uppercase tracking-[0.2em] text-primary">Inteligência Financeira · Admin</p>
        <h1 className="mt-2 font-ops-display text-3xl font-semibold uppercase leading-none md:text-4xl">Qual projeto você quer abrir?</h1>
        <p className="mt-2 max-w-xl text-sm text-ops-ink-foreground/70">
          Escolha um projeto para ver resultados, custos e rateios dos quadros ligados a ele. Quadros sem projeto ficam agrupados em “Sem projeto”.
        </p>
        <div className="relative mt-5 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(0); }}
            placeholder="Buscar projeto ou equipe"
            className="h-10 bg-background pl-9 text-foreground"
          />
        </div>
      </section>

      <div className="flex items-baseline justify-between px-1">
        <span className="font-ops-label text-[11px] uppercase tracking-widest text-muted-foreground">
          {isLoading ? "Carregando" : `${filtered.length} de ${list.length} projetos e grupos`}
        </span>
      </div>

      {isError ? (
        <div className="rounded-xl border border-destructive/40 p-6 text-sm">
          Não foi possível carregar os projetos.{" "}
          <Button variant="link" className="h-auto p-0" onClick={() => refetch()}>Tentar de novo</Button>
        </div>
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhum projeto com “{q}”. Tente outro nome.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => {
            const unlinked = t.kind === "unlinked";
            return (
              <button
                key={key(t)}
                onClick={() => setTeamId(key(t))}
                className={`group flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${unlinked ? "border-dashed" : ""}`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-ops-display text-lg font-semibold uppercase ${unlinked ? "bg-muted text-muted-foreground" : "bg-ops-ink text-primary"}`}>
                  {unlinked ? <FolderKanban className="h-4 w-4" /> : t.name?.trim()?.[0]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold group-hover:text-primary">{t.name}</span>
                  <span className="block truncate font-ops-label text-[10px] uppercase tracking-wider text-muted-foreground">
                    {t.team_name} · {t.board_ids.length} {t.board_ids.length === 1 ? "quadro" : "quadros"}{!unlinked && !t.finance_enabled ? " · financeiro desligado" : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {!isLoading && !isError && pages > 1 && (
        <nav className="flex items-center justify-center gap-2" aria-label="Paginação">
          <Button variant="outline" size="sm" className="h-8" disabled={cur === 0} onClick={() => setPage(cur - 1)}>
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <span className="font-ops-label text-[11px] uppercase tracking-widest text-muted-foreground">
            Página {cur + 1} de {pages}
          </span>
          <Button variant="outline" size="sm" className="h-8" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>
            Próxima <ChevronRight className="h-4 w-4" />
          </Button>
        </nav>
      )}
    </div>
  );
}
