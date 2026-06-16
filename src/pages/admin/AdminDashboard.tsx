import { useAdminStats } from "@/hooks/admin/useAdminStats";
import { useAdminDashboardData } from "@/hooks/admin/useAdminDashboardData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, CreditCard, Ticket, LayoutList, Clock, TrendingUp, TrendingDown, AlertTriangle, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
];

function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
  trend,
  alert,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  isLoading: boolean;
  trend?: { value: number; label: string };
  alert?: boolean;
}) {
  return (
    <Card className="relative overflow-hidden">
      <SEOHead title="Admin - Dashboard" />
      <CardHeader className="flex flex-row items-center justify-between pb-1 sm:pb-2 space-y-0 p-3 sm:p-4 md:p-6">
        <CardTitle className="text-[10px] sm:text-xs font-medium text-muted-foreground tracking-wide uppercase leading-tight">
          {label}
        </CardTitle>
        <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="pb-3 sm:pb-4 px-3 sm:px-4 md:px-6 pt-0">
        {isLoading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <div className="flex flex-col gap-0.5">
            <p className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight">{value.toLocaleString("pt-BR")}</p>
            <div className="flex items-center gap-1 min-h-[16px]">
              {trend && trend.value > 0 && (
                <span className="flex items-center gap-0.5 text-[10px] sm:text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-3 w-3" />+{trend.value}
                  <span className="text-muted-foreground ml-0.5">{trend.label}</span>
                </span>
              )}
              {alert && (
                <span className="flex items-center gap-0.5 text-[10px] sm:text-xs font-medium text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  <span>expirando</span>
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading } = useAdminStats();
  const { recentTeams, recentUsers, expiringTrials, planDistribution, monthlyGrowth } = useAdminDashboardData();
  const navigate = useNavigate();

  const growthChartConfig = {
    users: { label: "Usuários", color: "hsl(var(--primary))" },
    teams: { label: "Equipes", color: "hsl(var(--chart-2, 160 60% 45%))" },
  };

  const planChartConfig: Record<string, { label: string; color: string }> = {};
  (planDistribution.data ?? []).forEach((p, i) => {
    planChartConfig[p.name] = { label: p.name, color: PIE_COLORS[i % PIE_COLORS.length] };
  });

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const statusLabel = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      active: { label: "Ativo", variant: "default" },
      trialing: { label: "Trial", variant: "secondary" },
      canceled: { label: "Cancelado", variant: "destructive" },
      past_due: { label: "Vencido", variant: "destructive" },
    };
    return map[status] ?? { label: status, variant: "outline" as const };
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 max-w-[1400px] mx-auto">
      <SEOHead title="Admin - Dashboard" />
      {/* Header */}
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Visão geral do sistema SoMA</p>
        </div>
        <p className="text-[10px] sm:text-xs text-muted-foreground shrink-0">
          Atualizado {format(new Date(), "dd/MM · HH:mm")}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        <StatCard label="Equipes" value={stats?.totalTeams ?? 0} icon={Building2} isLoading={isLoading} trend={{ value: stats?.newTeamsLast30Days ?? 0, label: "30d" }} />
        <StatCard label="Usuários" value={stats?.totalUsers ?? 0} icon={Users} isLoading={isLoading} trend={{ value: stats?.newUsersLast30Days ?? 0, label: "30d" }} />
        <StatCard label="Assinaturas" value={stats?.activeSubscriptions ?? 0} icon={CreditCard} isLoading={isLoading} />
        <StatCard label="Trials" value={stats?.activeTrials ?? 0} icon={Clock} isLoading={isLoading} alert={(expiringTrials.data?.length ?? 0) > 0} />
        <StatCard label="Cupons" value={stats?.activeCoupons ?? 0} icon={Ticket} isLoading={isLoading} />
        <StatCard label="Demandas" value={stats?.totalDemands ?? 0} icon={LayoutList} isLoading={isLoading} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Growth Chart */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Crescimento Mensal</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] sm:h-[260px]">
            {monthlyGrowth.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <ChartContainer config={growthChartConfig} className="h-full w-full">
                <AreaChart data={monthlyGrowth.data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="fillUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fillTeams" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-2, 160 60% 45%))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--chart-2, 160 60% 45%))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="users" stroke="hsl(var(--primary))" fill="url(#fillUsers)" strokeWidth={2} />
                  <Area type="monotone" dataKey="teams" stroke="hsl(var(--chart-2, 160 60% 45%))" fill="url(#fillTeams)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Distribuição por Plano</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] sm:h-[260px] flex items-center justify-center">
            {planDistribution.isLoading ? (
              <Skeleton className="h-40 w-40 rounded-full" />
            ) : (planDistribution.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma assinatura ativa</p>
            ) : (
              <div className="flex flex-col items-center gap-3 w-full">
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={planDistribution.data}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      strokeWidth={2}
                      stroke="hsl(var(--background))"
                    >
                      {(planDistribution.data ?? []).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number, name: string) => [`${value} equipes`, name]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--card-foreground))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-3">
                  {(planDistribution.data ?? []).map((p, i) => (
                    <div key={p.name} className="flex items-center gap-1.5 text-xs">
                      <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{p.name}</span>
                      <span className="font-semibold">{p.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {/* Recent Teams */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-medium">Equipes Recentes</CardTitle>
            <button onClick={() => navigate("/admin/teams")} className="text-xs text-primary hover:underline flex items-center gap-1">
              Ver todas <ArrowRight className="h-3 w-3" />
            </button>
          </CardHeader>
          <CardContent className="p-0">
            {recentTeams.isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {(recentTeams.data ?? []).map((team: any) => {
                  const sub = team.subscriptions?.[0];
                  const st = sub ? statusLabel(sub.status) : null;
                  return (
                    <div key={team.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                      <SEOHead title="Admin - Dashboard" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{team.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(team.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {sub?.plans?.name && (
                          <span className="text-xs text-muted-foreground">{sub.plans.name}</span>
                        )}
                        {st && <Badge variant={st.variant} className="text-[10px] h-5">{st.label}</Badge>}
                      </div>
                    </div>
                  );
                })}
                {(recentTeams.data?.length ?? 0) === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhuma equipe cadastrada</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiring Trials */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Trials Expirando
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {expiringTrials.isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (expiringTrials.data?.length ?? 0) === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-2">
                  <Clock className="h-5 w-5 text-emerald-500" />
                </div>
                <p className="text-sm text-muted-foreground">Nenhum trial expirando nos próximos 7 dias</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {(expiringTrials.data ?? []).map((trial: any) => {
                  const teamName = trial.teams?.name ?? "Equipe";
                  const expiresIn = formatDistanceToNow(new Date(trial.trial_ends_at), { locale: ptBR, addSuffix: true });
                  return (
                    <div key={trial.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors">
                      <SEOHead title="Admin - Dashboard" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{teamName}</p>
                        <p className="text-xs text-muted-foreground">Expira {expiresIn}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] h-5 border-amber-500/50 text-amber-600 dark:text-amber-400">
                        {format(new Date(trial.trial_ends_at), "dd/MM")}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-sm font-medium">Usuários Recentes</CardTitle>
          <button onClick={() => navigate("/admin/users")} className="text-xs text-primary hover:underline flex items-center gap-1">
            Ver todos <ArrowRight className="h-3 w-3" />
          </button>
        </CardHeader>
        <CardContent className="p-0">
          {recentUsers.isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {(recentUsers.data ?? []).map((user: any) => (
                <div key={user.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar_url ?? undefined} alt={user.full_name} />
                    <AvatarFallback className="text-xs">{getInitials(user.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(user.created_at), "dd/MM/yyyy")}
                  </span>
                </div>
              ))}
              {(recentUsers.data?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum usuário cadastrado</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
