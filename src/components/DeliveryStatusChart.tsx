import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface StatusData {
  name: string;
  count: number;
  color: string;
}

interface DeliveryStatusChartProps {
  data: StatusData[];
}

export function DeliveryStatusChart({ data }: DeliveryStatusChartProps) {
  const hasData = data && data.length > 0;
  
  // Default empty state data for visualization
  const emptyData = [
    { name: "Sem dados", value: 1, color: "#e5e7eb" }
  ];

  const chartData = hasData 
    ? data.map(item => ({
        name: item.name,
        value: item.count,
        color: item.color,
      }))
    : emptyData;


  return (
    <div className="relative">
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <span className="text-muted-foreground text-sm bg-background/80 px-3 py-1 rounded-md">
            Sem demandas
          </span>
        </div>
      )}
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={80}
          paddingAngle={hasData ? 5 : 0}
          dataKey="value"
          label={hasData ? ({ name, value }) => `${name}: ${value}` : false}
          labelLine={false}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} opacity={hasData ? 1 : 0.3} />
          ))}
        </Pie>
        {hasData && (
          <Tooltip 
            formatter={(value: number, name: string) => [value, name]}
            contentStyle={{
              backgroundColor: 'hsl(var(--popover))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              color: 'hsl(var(--popover-foreground))',
            }}
            itemStyle={{
              color: 'hsl(var(--popover-foreground))',
            }}
            labelStyle={{
              color: 'hsl(var(--popover-foreground))',
            }}
          />
        )}
        {hasData && (
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value) => <span className="text-foreground text-sm">{value}</span>}
          />
        )}
      </PieChart>
    </ResponsiveContainer>
    </div>
  );
}
