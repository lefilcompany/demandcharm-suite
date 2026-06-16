import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useDemands } from "@/hooks/useDemands";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import { FileDown, BarChart3, TrendingUp, Users, Clock } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SEOHead } from "@/components/SEOHead";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#10b981", "#f59e0b", "#ef4444"];

export default function Reports() {
  const { selectedTeamId } = useSelectedTeam();
  const { data: demands } = useDemands(selectedTeamId || undefined);
  const { data: members } = useTeamMembers(selectedTeamId);
  const [period, setPeriod] = useState<"week" | "month" | "quarter">("month");

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "week":
        return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
      case "month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "quarter":
        return { start: subDays(now, 90), end: now };
    }
  }, [period]);

  const filteredDemands = useMemo(() => {
    return demands?.filter((d) =>
      isWithinInterval(new Date(d.created_at), dateRange)
    ) || [];
  }, [demands, dateRange]);

  // Status distribution
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredDemands.forEach((d) => {
      const name = (d.demand_statuses as any)?.name || "Sem status";
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredDemands]);

  // Priority distribution
  const priorityData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredDemands.forEach((d) => {
      counts[d.priority || "média"] = (counts[d.priority || "média"] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredDemands]);

  // Throughput by day
  const throughputData = useMemo(() => {
    const deliveredStatus = demands?.find((d) => 
      (d.demand_statuses as any)?.name === "Entregue"
    )?.status_id;
    
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), 29 - i);
      const dateStr = format(date, "dd/MM");
      const created = demands?.filter(
        (d) => format(new Date(d.created_at), "dd/MM") === dateStr
      ).length || 0;
      const delivered = demands?.filter(
        (d) => d.status_id === deliveredStatus && format(new Date(d.updated_at), "dd/MM") === dateStr
      ).length || 0;
      return { date: dateStr, criadas: created, entregues: delivered };
    });
    return last30Days;
  }, [demands]);

  // Workload by member
  const workloadData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredDemands.forEach((d) => {
      const assignees = (d as any).demand_assignees || [];
      assignees.forEach((a: any) => {
        const name = a.profiles?.full_name || "Não atribuído";
        counts[name] = (counts[name] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [filteredDemands]);

  // Average completion time
  const avgCompletionTime = useMemo(() => {
    const deliveredStatus = demands?.find((d) => 
      (d.demand_statuses as any)?.name === "Entregue"
    )?.status_id;
    
    const completed = filteredDemands.filter((d) => d.status_id === deliveredStatus);
    if (completed.length === 0) return 0;
    
    const totalDays = completed.reduce((sum, d) => {
      return sum + differenceInDays(new Date(d.updated_at), new Date(d.created_at));
    }, 0);
    
    return Math.round(totalDays / completed.length);
  }, [filteredDemands, demands]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text("Relatório de Demandas", 14, 22);
    doc.setFontSize(12);
    doc.text(`Período: ${format(dateRange.start, "dd/MM/yyyy")} - ${format(dateRange.end, "dd/MM/yyyy")}`, 14, 32);

    // Stats
    doc.setFontSize(14);
    doc.text("Resumo", 14, 45);
    doc.setFontSize(10);
    doc.text(`Total de demandas: ${filteredDemands.length}`, 14, 55);
    doc.text(`Tempo médio de conclusão: ${avgCompletionTime} dias`, 14, 62);

    // Status table
    autoTable(doc, {
      startY: 75,
      head: [["Status", "Quantidade"]],
      body: statusData.map((s) => [s.name, s.value]),
    });

    doc.save(`relatorio-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  if (!selectedTeamId) {
    return (
      <div className="text-center py-12">
        <SEOHead title="Relatórios" path="/reports" />
        <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">Selecione uma equipe</h3>
        <p className="text-muted-foreground">Use o seletor no menu para ver relatórios</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <SEOHead title="Relatórios" path="/reports" />
      {/* Breadcrumbs */}
      <PageBreadcrumb
        items={[
          { label: "Relatórios", icon: BarChart3, isCurrent: true },
        ]}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground">Análise detalhada das demandas</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportPDF}>
            <FileDown className="mr-2 h-4 w-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Demandas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{filteredDemands.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tempo Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{avgCompletionTime} dias</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Membros Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{members?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Taxa de Conclusão</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {filteredDemands.length > 0
                ? Math.round((statusData.find((s) => s.name === "Entregue")?.value || 0) / filteredDemands.length * 100)
                : 0}%
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Throughput (Últimos 30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={throughputData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                  <Line type="monotone" dataKey="criadas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="entregues" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {statusData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Carga por Membro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {priorityData.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={
                          entry.name === "alta" ? "#ef4444" :
                          entry.name === "média" ? "#f59e0b" : "#10b981"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
