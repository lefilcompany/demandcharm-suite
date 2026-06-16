import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHierarchicalServices, ServiceWithHierarchy } from "@/hooks/useServices";
import { useBoardServicesWithUsage, useHasBoardServices } from "@/hooks/useBoardServices";
import { Clock, AlertTriangle, Infinity as InfinityIcon, Info, Folder, ChevronDown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPrice } from "@/lib/priceUtils";
import { useMemo, useState, useEffect } from "react";

interface ServiceSelectorProps {
  teamId: string | null;
  boardId?: string | null;
  value: string;
  onChange: (serviceId: string, estimatedHours?: number) => void;
  disabled?: boolean;
  /** User's role in the board - used to show/hide requester-specific info */
  userRole?: "admin" | "moderator" | "executor" | "requester" | null;
}

interface DisplayService {
  id: string;
  name: string;
  estimated_hours: number;
  description: string | null;
  price_cents: number;
  currentCount: number;
  monthlyLimit: number;
  remaining: number;
  isLimitReached: boolean;
  isCategory?: boolean;
  parent_id?: string | null;
}

export function ServiceSelector({
  teamId,
  boardId,
  value,
  onChange,
  disabled = false,
  userRole,
}: ServiceSelectorProps) {
  const { data: hierarchicalServices, isLoading: servicesLoading, rawServices } = useHierarchicalServices(teamId, boardId);
  const { hasBoardServices, isLoading: boardServicesLoading } = useHasBoardServices(boardId);
  const { data: boardServicesUsage, isLoading: usageLoading } = useBoardServicesWithUsage(boardId);
  
  // Track which categories are expanded
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const isLoading = servicesLoading || boardServicesLoading || usageLoading;

  // Build services list with board usage info if applicable
  const { categories, standaloneServices, allDisplayServices } = useMemo(() => {
    if (!rawServices) return { categories: [], standaloneServices: [], allDisplayServices: [] };

    // Create a map for board service usage (only for services with configured limits)
    const boardUsageMap = new Map(
      boardServicesUsage?.map(bs => [bs.service_id, bs]) || []
    );

    // Set of service IDs available for this board
    const boardServiceIds = new Set(
      boardServicesUsage?.map(bs => bs.service_id) || []
    );

    const buildDisplayService = (service: any): DisplayService | null => {
      const boardUsage = boardUsageMap.get(service.id);
      
      // If board has services configured, only show services linked to this board
      if (hasBoardServices && !service.isCategory && !boardUsage) {
        return null;
      }
      
      if (boardUsage) {
        return {
          id: service.id,
          name: service.name,
          estimated_hours: service.estimated_hours || 0,
          description: service.description || null,
          price_cents: service.price_cents || 0,
          currentCount: boardUsage.currentCount || 0,
          monthlyLimit: boardUsage.monthly_limit || 0,
          remaining: boardUsage.remaining || 0,
          isLimitReached: boardUsage.isLimitReached || false,
          isCategory: service.isCategory,
          parent_id: service.parent_id,
        };
      }
      
      return {
        id: service.id,
        name: service.name,
        estimated_hours: service.estimated_hours || 0,
        description: service.description || null,
        price_cents: service.price_cents || 0,
        currentCount: 0,
        monthlyLimit: 0,
        remaining: Infinity,
        isLimitReached: false,
        isCategory: service.isCategory,
        parent_id: service.parent_id,
      };
    };

    // Separate categories and standalone services
    const cats: { category: DisplayService; children: DisplayService[] }[] = [];
    const standalone: DisplayService[] = [];
    const allDisplay: DisplayService[] = [];

    hierarchicalServices?.forEach(service => {
      if (service.isCategory) {
        const categoryDisplay = buildDisplayService(service);
        const childrenDisplay = service.children
          .map(child => buildDisplayService(child))
          .filter((c): c is DisplayService => c !== null);
        // Only show category if it has visible children
        if (childrenDisplay.length > 0) {
          cats.push({ category: categoryDisplay || { ...buildDisplayService(service)!, isCategory: true }, children: childrenDisplay });
          allDisplay.push(...childrenDisplay);
        }
      } else {
        const display = buildDisplayService(service);
        if (display) {
          standalone.push(display);
          allDisplay.push(display);
        }
      }
    });

    return { categories: cats, standaloneServices: standalone, allDisplayServices: allDisplay };
  }, [hierarchicalServices, rawServices, boardServicesUsage]);

  // Auto-expand category if a child is selected
  useEffect(() => {
    if (value && value !== "none") {
      categories.forEach(({ category, children }) => {
        if (children.some(child => child.id === value)) {
          setExpandedCategories(prev => new Set(prev).add(category.id));
        }
      });
    }
  }, [value, categories]);

  const toggleCategory = (categoryId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleChange = (serviceId: string) => {
    if (serviceId === "none") {
      onChange("none", undefined);
      return;
    }
    
    // Ignore category clicks
    if (serviceId.startsWith("category-")) {
      return;
    }
    
    const service = allDisplayServices.find((s) => s.id === serviceId);
    if (service?.isLimitReached) {
      return;
    }
    onChange(serviceId, service?.estimated_hours);
  };

  const selectedService = allDisplayServices.find(s => s.id === value);

  const renderServiceItem = (service: DisplayService, indented: boolean = false) => (
    <SelectItem 
      key={service.id} 
      value={service.id}
      disabled={service.isLimitReached}
      className={`${service.isLimitReached ? "opacity-50" : ""} ${indented ? "pl-6 border-l-2 border-muted ml-2" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <span className="font-medium truncate max-w-[120px] sm:max-w-none">{service.name}</span>
        {service.price_cents > 0 && (
          <span className="text-xs font-semibold text-primary flex items-center gap-0.5 whitespace-nowrap">
            {formatPrice(service.price_cents)}
          </span>
        )}
        <span className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
          <Clock className="h-3 w-3 shrink-0" />
          {service.estimated_hours}h
        </span>
        {hasBoardServices && (
          <>
            {service.isLimitReached ? (
              <span className="text-xs font-medium text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                LIMITE
              </span>
            ) : service.monthlyLimit > 0 ? (
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                ({service.remaining} restantes)
              </span>
            ) : (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <InfinityIcon className="h-3 w-3 shrink-0" />
              </span>
            )}
          </>
        )}
      </div>
    </SelectItem>
  );

  const renderCategoryHeader = (category: DisplayService, childCount: number) => {
    const isExpanded = expandedCategories.has(category.id);
    
    return (
      <div
        key={`header-${category.id}`}
        onClick={(e) => toggleCategory(category.id, e)}
        className="flex items-center gap-2 px-2 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted rounded-sm cursor-pointer select-none transition-colors"
      >
        <ChevronDown 
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`} 
        />
        <Folder className="h-4 w-4 shrink-0" />
        <span className="flex-1">{category.name}</span>
        <span className="text-xs text-muted-foreground/60 tabular-nums">{childCount}</span>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <Select
        value={value}
        onValueChange={handleChange}
        disabled={disabled || !teamId || isLoading}
      >
        <SelectTrigger className={`h-8 ${selectedService?.isLimitReached ? "border-destructive" : ""}`}>
          <SelectValue placeholder={
            hasBoardServices 
              ? "Selecione um serviço *" 
              : "Selecione um serviço (opcional)"
          } />
        </SelectTrigger>
        <SelectContent>
          {!hasBoardServices && (
            <SelectItem value="none">Nenhum serviço</SelectItem>
          )}
          
          {/* Standalone services (no category) */}
          {standaloneServices.map((service) => renderServiceItem(service))}
          
          {/* Categories with expandable children */}
          {categories.map(({ category, children }) => (
            <div key={category.id}>
              {renderCategoryHeader(category, children.length)}
              {expandedCategories.has(category.id) && (
                <div className="space-y-0.5">
                  {children.map((child) => renderServiceItem(child, true))}
                </div>
              )}
            </div>
          ))}
          
          {allDisplayServices.length === 0 && standaloneServices.length === 0 && (
            <SelectItem value="no-services" disabled>
              Nenhum serviço disponível
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      
      {/* Info about when time starts counting - only shown for requesters */}
      {userRole === "requester" && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-help">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span className="leading-tight">O prazo inicia após aprovação da solicitação</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[250px]">
              <p className="text-xs">
                O tempo estimado para conclusão só começa a contar a partir do momento em que sua solicitação for aprovada pela equipe.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
