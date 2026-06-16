import { useState } from "react";
import { Filter, Calendar, X } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export type PeriodFilter = "current_month" | "last_month" | "3_months" | "6_months" | "this_year" | "all";

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: "current_month", label: "Mês atual" },
  { value: "last_month", label: "Mês passado" },
  { value: "3_months", label: "Últimos 3 meses" },
  { value: "6_months", label: "Últimos 6 meses" },
  { value: "this_year", label: "Este ano" },
  { value: "all", label: "Todo o período" },
];

interface TimeFiltersPopoverProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  userFilter: string;
  onUserFilterChange: (value: string) => void;
  periodFilter: PeriodFilter;
  onPeriodFilterChange: (value: PeriodFilter) => void;
  uniqueUsers: Profile[];
  startDate?: Date;
  endDate?: Date;
  onClearFilters: () => void;
}

export function TimeFiltersPopover({
  searchTerm,
  onSearchChange,
  userFilter,
  onUserFilterChange,
  periodFilter,
  onPeriodFilterChange,
  uniqueUsers,
  startDate,
  endDate,
  onClearFilters,
}: TimeFiltersPopoverProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const activeFiltersCount = [
    searchTerm !== "",
    userFilter !== "all",
    periodFilter !== "current_month",
  ].filter(Boolean).length;

  const periodLabel = periodOptions.find(p => p.value === periodFilter)?.label || "Mês atual";
  const userLabel = userFilter !== "all" 
    ? uniqueUsers.find(u => u.id === userFilter)?.full_name || "Usuário"
    : null;

  // Count only search and user filters (period is outside now)
  const filtersInsideCount = [
    searchTerm !== "",
    userFilter !== "all",
  ].filter(Boolean).length;

  const FilterContent = () => (
    <div className="space-y-4">
      {/* Search */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Buscar</label>
        <Input
          placeholder="Demanda ou usuário..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full"
        />
      </div>

      {/* User Filter */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Usuário</label>
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
      </div>

      {/* Period indicator */}
      {periodFilter !== "all" && startDate && endDate && (
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Período: {format(startDate, "dd/MM/yyyy")} até {format(endDate, "dd/MM/yyyy")}
          </p>
        </div>
      )}

      {/* Clear filters */}
      {filtersInsideCount > 0 && (
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={onClearFilters}
          className="w-full text-muted-foreground"
        >
          <X className="h-4 w-4 mr-2" />
          Limpar filtros
        </Button>
      )}
    </div>
  );

  const TriggerButton = (
    <Button variant="outline" size="sm" className="gap-1.5 h-8 px-2 sm:px-3">
      <Filter className="h-4 w-4" />
      <span className="hidden sm:inline">Filtros</span>
      {filtersInsideCount > 0 && (
        <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
          {filtersInsideCount}
        </Badge>
      )}
    </Button>
  );

  // Period selector component to be shown outside the filter
  const PeriodSelector = () => (
    <Select value={periodFilter} onValueChange={(v) => onPeriodFilterChange(v as PeriodFilter)}>
      <SelectTrigger className="h-8 w-auto min-w-[120px] sm:min-w-[140px] text-xs sm:text-sm">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
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
  );

  if (isMobile) {
    return (
      <div className="flex items-center gap-2">
        <PeriodSelector />
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>
            {TriggerButton}
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Filtros</DrawerTitle>
            </DrawerHeader>
            <div className="p-4 pb-8">
              <FilterContent />
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <PeriodSelector />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {TriggerButton}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <div className="space-y-1 mb-4">
            <h4 className="font-medium text-sm">Filtros</h4>
            <p className="text-xs text-muted-foreground">
              Refine os dados exibidos
            </p>
          </div>
          <FilterContent />
        </PopoverContent>
      </Popover>
    </div>
  );
}
