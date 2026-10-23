import { useMemo } from "react";
import { useAdminStats } from "@/hooks/admin/useAdminStats";
import { useAdminDashboardData } from "@/hooks/admin/useAdminDashboardData";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { SEOHead } from "@/components/SEOHead";
import {
  ArrivalsFeed,
  CommandStrip,
  OpsLabel,
  PlanSplitBar,
  TrialTimeline,
  type Arrival,
  type CommandMetric,
} from "@/components/ops/OpsParts";

const subStatus: Record<string, string> = { active: "Ativo", trialing: "Trial", canceled: "Cancelado", past_due: "Vencido" };

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminStats();
  const { recentTeams, recentUsers, expiringTrials, planDistribution, monthlyGrowth } = useAdminDashboardData();
  const s = stats;

  const metrics: CommandMetric[] = [
    {
      label: "Equipes",
      value: s?.totalTeams ?? 0,
      note: `+${s?.newTeamsLast30Days ?? 0} em 30 dias`,
      gauge: s?.totalTeams ? (s.newTeamsLast30Days ?? 0) / s.totalTeams : 0,
    },
    {
      label: "Usuários",
      value: s?.totalUsers ?? 0,
      note: `+${s?.newUsersLast30Days ?? 0} em 30 dias`,
      gauge: s?.totalUsers ? (s.newUsersLast30Days ?? 0) / s.totalUsers : 0,
    },
    {
      label: "Assinaturas",
      value: s?.activeSubscriptions ?? 0,
      note: `${s?.activeTrials ?? 0} em trial`,
      gauge: s?.totalTeams ? (s.activeSubscriptions ?? 0) / s.totalTeams : 0,
    },
    {
      label: "Demandas",
      value: s?.totalDemands ?? 0,
      note: `${s?.activeCoupons ?? 0} cupons ativos`,
    },
  ];

  const arrivals = useMemo<Arrival[]>(() => {
    const teams: Arrival[] = (recentTeams.data ?? []).map((t: any) => {
      const sub = t.subscriptions?.[0];
      return {
        id: t.id,
        kind: "team",
        name: t.name,
        detail: sub?.plans?.name,
        badge: sub ? subStatus[sub.status] ?? sub.status : undefined,
        created_at: t.created_at,
      };
    });
    const users: Arrival[] = (recentUsers.data ?? []).map((u: any) => ({
      id: u.id,
      kind: "user",
      name: u.full_name,
      detail: u.email,
      created_at: u.created_at,
    }));
    return [...teams, ...users].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8);
  }, [recentTeams.data, recentUsers.data]);

  const growthConfig = {
    users: { label: "Usuários", color: "hsl(var(--primary))" },
    teams: { label: "Equipes", color: "hsl(var(--ops-ink))" },
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      <SEOHead title="Admin - Dashboard" />
      <h1 className="sr-only">Painel do administrador</h1>

      <CommandStrip metrics={metrics} loading={isLoading} updatedAt={new Date()} />

      <TrialTimeline trials={(expiringTrials.data ?? []) as any} loading={expiringTrials.isLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <section aria-label="Crescimento" className="lg:col-span-3 rounded-xl border bg-card p-4 sm:p-5 shadow-sm">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-semibold">Crescimento</h2>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" /><OpsLabel>Usuários</OpsLabel></span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-ops-ink" /><OpsLabel>Equipes</OpsLabel></span>
              <OpsLabel className="hidden sm:inline">· 6 meses</OpsLabel>
            </div>
          </div>
          <div className="h-[200px] sm:h-[240px]">
            {monthlyGrowth.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ChartContainer config={growthConfig} className="h-full w-full">
                <BarChart data={monthlyGrowth.data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barGap={2}>
                  <CartesianGrid vertical={false} strokeDasharray="2 4" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
                  <ChartTooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent />} />
                  <Bar dataKey="users" fill="var(--color-users)" radius={[3, 3, 0, 0]} maxBarSize={22} />
                  <Bar dataKey="teams" fill="var(--color-teams)" radius={[3, 3, 0, 0]} maxBarSize={22} />
                </BarChart>
              </ChartContainer>
            )}
          </div>
        </section>
        <div className="lg:col-span-2">
          <PlanSplitBar plans={planDistribution.data ?? []} loading={planDistribution.isLoading} />
        </div>
      </div>

      <ArrivalsFeed items={arrivals} loading={recentTeams.isLoading || recentUsers.isLoading} />
    </div>
  );
}
