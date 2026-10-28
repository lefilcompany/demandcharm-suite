import { useMemo, useState } from "react";
import { ArrowLeft, Search, Users } from "lucide-react";
import { useAdminTeams } from "@/hooks/admin/useAdminTeams";
import Finance from "@/pages/Finance";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminFinance() {
  const { data: teams = [], isLoading, isError, refetch } = useAdminTeams();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const list = teams as any[];
  const team = list.find((t) => t.id === teamId);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? list.filter((t) => t.name?.toLowerCase().includes(s)) : list;
  }, [list, q]);

  if (teamId) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setTeamId(null)} className="h-8 gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Trocar equipe
          </Button>
          <span className="font-ops-label text-[11px] uppercase tracking-widest text-muted-foreground">Equipe</span>
          <span className="truncate text-sm font-semibold">{team?.name}</span>
        </div>
        <Finance key={teamId} teamId={teamId} teamName={team?.name} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="rounded-xl bg-ops-ink p-5 text-ops-ink-foreground shadow-xl md:p-7">
        <p className="font-ops-label text-[11px] uppercase tracking-[0.2em] text-primary">Inteligência Financeira · Admin</p>
        <h1 className="mt-2 font-ops-display text-3xl font-semibold uppercase leading-none md:text-4xl">Qual equipe você quer abrir?</h1>
        <p className="mt-2 max-w-xl text-sm text-ops-ink-foreground/70">
          Escolha uma equipe para ver resultados, custos, rateios e o fechamento do mês dela.
        </p>
        <div className="relative mt-5 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar equipe pelo nome"
            className="h-10 bg-background pl-9 text-foreground"
          />
        </div>
      </section>

      <div className="flex items-baseline justify-between px-1">
        <span className="font-ops-label text-[11px] uppercase tracking-widest text-muted-foreground">
          {isLoading ? "Carregando" : `${filtered.length} de ${list.length} equipes`}
        </span>
      </div>

      {isError ? (
        <div className="rounded-xl border border-destructive/40 p-6 text-sm">
          Não foi possível carregar as equipes.{" "}
          <Button variant="link" className="h-auto p-0" onClick={() => refetch()}>Tentar de novo</Button>
        </div>
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nenhuma equipe com “{q}”. Tente outro nome.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const sub = Array.isArray(t.subscriptions) ? t.subscriptions[0] : t.subscriptions;
            const plan = sub?.plans?.name;
            return (
              <button
                key={t.id}
                onClick={() => setTeamId(t.id)}
                className="group flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ops-ink font-ops-display text-lg font-semibold uppercase text-primary">
                  {t.name?.trim()?.[0] ?? <Users className="h-4 w-4" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold group-hover:text-primary">{t.name}</span>
                  <span className="block truncate font-ops-label text-[10px] uppercase tracking-wider text-muted-foreground">
                    {plan ? `${plan} · ${sub?.status ?? ""}` : "Sem plano"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
