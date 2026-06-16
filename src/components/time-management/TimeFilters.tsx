import { Filter, Calendar } from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, startOfYear, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export type PeriodFilter = "current_month" | "last_month" | "3_months" | "6_months" | "this_year" | "all";

export function getPeriodDates(period: PeriodFilter): { start: Date | undefined; end: Date | undefined } {
  const now = new Date();
  
  switch (period) {
    case "current_month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month":
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case "3_months":
      return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    case "6_months":
      return { start: startOfMonth(subMonths(now, 5)), end: endOfMonth(now) };
    case "this_year":
      return { start: startOfYear(now), end: endOfMonth(now) };
    case "all":
      return { start: undefined, end: undefined };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: "current_month", label: "Mês atual" },
  { value: "last_month", label: "Mês passado" },
  { value: "3_months", label: "Últimos 3 meses" },
  { value: "6_months", label: "Últimos 6 meses" },
  { value: "this_year", label: "Este ano" },
  { value: "all", label: "Todo o período" },
];

interface TimeFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  userFilter: string;
  onUserFilterChange: (value: string) => void;
  periodFilter: PeriodFilter;
  onPeriodFilterChange: (value: PeriodFilter) => void;
  uniqueUsers: Profile[];
  startDate?: Date;
  endDate?: Date;
}

export function TimeFilters({
  searchTerm,
  onSearchChange,
  userFilter,
  onUserFilterChange,
  periodFilter,
  onPeriodFilterChange,
  uniqueUsers,
  startDate,
  endDate,
}: TimeFiltersProps) {
  const periodLabel = periodOptions.find(p => p.value === periodFilter)?.label || "Mês atual";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Filter className="h-4 w-4" />
          Filtros
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Input
              placeholder="Buscar por demanda ou usuário..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full"
            />
          </div>

          {/* User Filter */}
          <Select value={userFilter} onValueChange={onUserFilterChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Todos os usuários" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os usuários</SelectItem>
              {uniqueUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Period Filter */}
          <Select value={periodFilter} onValueChange={(v) => onPeriodFilterChange(v as PeriodFilter)}>
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder={periodLabel} />
              </div>
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Period indicator */}
        {periodFilter !== "all" && startDate && endDate && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground">
              Exibindo dados de{" "}
              <span className="font-medium text-foreground">
                {format(startDate, "dd/MM/yyyy")}
              </span>
              {" "}até{" "}
              <span className="font-medium text-foreground">
                {format(endDate, "dd/MM/yyyy")}
              </span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
