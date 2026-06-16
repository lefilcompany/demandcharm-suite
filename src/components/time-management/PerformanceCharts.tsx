import { Activity, BarChart3, TrendingUp, PieChart as PieChartIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTimeDisplay } from "@/hooks/useLiveTimer";
import { truncateText } from "@/lib/utils";
import { 
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  LineChart, Line, CartesianGrid, Legend, Area, AreaChart
} from "recharts";
import { BoardMemberWithTime } from "@/hooks/useBoardTimeEntries";
import { StatusTimeData, DailyTimeData } from "@/hooks/useBoardTimeStats";

interface GroupedByDemand {
  demand: {
    id: string;
    title: string;
    status?: { name: string; color: string } | null;
    priority: string | null;
  };
  totalSeconds: number;
}

interface PerformanceChartsProps {
  members: BoardMemberWithTime[];
  groupedByDemand: GroupedByDemand[];
  statusDistribution: StatusTimeData[];
  dailyTrend: DailyTimeData[];
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(221, 83%, 53%)',
  'hsl(263, 70%, 50%)',
  'hsl(38, 92%, 50%)',
  'hsl(160, 84%, 39%)',
  'hsl(340, 82%, 52%)',
];

// Custom tooltip component for charts
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur border rounded-lg shadow-lg p-3">
        <p className="font-medium text-sm">{payload[0].payload.fullName || payload[0].payload.name}</p>
        <p className="text-primary font-mono text-sm">
          {formatTimeDisplay(payload[0].value) || `${payload[0].value} min`}
        </p>
      </div>
    );
  }
  return null;
};

export function PerformanceCharts({
  members,
  groupedByDemand,
  statusDistribution,
  dailyTrend,
}: PerformanceChartsProps) {
  const membersWithTime = members.filter(m => m.totalSeconds > 0);
  
  if (membersWithTime.length === 0 && groupedByDemand.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Row 1: User Distribution + Top Demands */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time Distribution by User Chart */}
        {membersWithTime.length > 0 && (
          <Card className="border-2 border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                Distribuição por Usuário
              </CardTitle>
              <CardDescription>
                Proporção do tempo dedicado por cada membro
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={membersWithTime.slice(0, 6).map((member) => ({
                        name: member.profile.full_name.split(' ')[0],
                        value: member.totalSeconds,
                        fullName: member.profile.full_name,
                      }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {membersWithTime.slice(0, 6).map((_, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                          stroke="hsl(var(--background))"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex flex-wrap justify-center gap-3 mt-4">
                {membersWithTime.slice(0, 6).map((member, index) => (
                  <div key={member.userId} className="flex items-center gap-1.5 text-sm">
                    <span 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                    />
                    <span className="text-muted-foreground">{member.profile.full_name.split(' ')[0]}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bar Chart - Top Demands */}
        {groupedByDemand.length > 0 && (
          <Card className="border-2 border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                Top Demandas por Tempo
              </CardTitle>
              <CardDescription>
                Demandas que mais consumiram tempo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={groupedByDemand.slice(0, 5).map((d) => ({
                      name: truncateText(d.demand.title, 18),
                      tempo: Math.round(d.totalSeconds / 60),
                      fullTitle: d.demand.title,
                    }))}
                    layout="vertical"
                    margin={{ left: 10, right: 30 }}
                  >
                    <XAxis 
                      type="number" 
                      tickFormatter={(v) => `${v}min`}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      width={120}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value} minutos`, 'Tempo']}
                      labelFormatter={(label, payload) => payload[0]?.payload?.fullTitle || label}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar 
                      dataKey="tempo" 
                      fill="hsl(var(--primary))" 
                      radius={[0, 6, 6, 0]}
                      background={{ fill: 'hsl(var(--muted))', radius: 6 }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Row 2: Status Distribution + Daily Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        {statusDistribution.length > 0 && (
          <Card className="border-2 border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <PieChartIcon className="h-5 w-5 text-primary" />
                </div>
                Tempo por Status
              </CardTitle>
              <CardDescription>
                Distribuição do tempo por status de demanda
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {statusDistribution.slice(0, 6).map((status) => {
                  const maxSeconds = Math.max(...statusDistribution.map(s => s.totalSeconds));
                  const percent = maxSeconds > 0 ? (status.totalSeconds / maxSeconds) * 100 : 0;
                  
                  return (
                    <div key={status.statusName} className="space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <span 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: status.statusColor }}
                          />
                          <span className="font-medium">{status.statusName}</span>
                          <span className="text-muted-foreground text-xs">
                            ({status.demandCount} demanda{status.demandCount !== 1 ? 's' : ''})
                          </span>
                        </div>
                        <span className="font-mono text-xs">
                          {formatTimeDisplay(status.totalSeconds) || "00:00:00:00"}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${percent}%`,
                            backgroundColor: status.statusColor,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Daily Trend */}
        {dailyTrend.length > 0 && dailyTrend.some(d => d.totalSeconds > 0) && (
          <Card className="border-2 border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                Evolução Diária
              </CardTitle>
              <CardDescription>
                Tempo registrado nos últimos 7 dias
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={dailyTrend.map(d => ({
                      ...d,
                      tempo: Math.round(d.totalSeconds / 60),
                    }))}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorTempo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="dateFormatted" 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tickFormatter={(v) => `${v}min`}
                      tick={{ fontSize: 11 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip 
                      formatter={(value: number) => [`${value} minutos`, 'Tempo']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="tempo" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fill="url(#colorTempo)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
