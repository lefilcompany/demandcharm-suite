import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useHierarchicalServices, ServiceWithHierarchy } from "@/hooks/useServices";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useSelectedBoardSafe } from "@/contexts/BoardContext";
import { useBoardServicesWithUsage, useHasBoardServices } from "@/hooks/useBoardServices";
import { formatPrice } from "@/lib/priceUtils";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { Clock, ShoppingCart, AlertTriangle, Infinity as InfinityIcon, Package, Folder } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";
import { SEOHead } from "@/components/SEOHead";

interface DisplayService {
  id: string;
  name: string;
  description: string | null;
  estimated_hours: number;
  price_cents: number;
  currentCount: number;
  monthlyLimit: number;
  remaining: number;
  isLimitReached: boolean;
}

export default function Store() {
  const navigate = useNavigate();
  const { selectedTeamId } = useSelectedTeam();
  const { selectedBoardId } = useSelectedBoardSafe();
  
  const { data: hierarchicalServices, isLoading: servicesLoading, rawServices } = useHierarchicalServices(selectedTeamId, selectedBoardId);
  const { hasBoardServices, isLoading: boardServicesLoading } = useHasBoardServices(selectedBoardId);
  const { data: boardServicesUsage, isLoading: usageLoading } = useBoardServicesWithUsage(selectedBoardId);

  const isLoading = servicesLoading || boardServicesLoading || usageLoading;

  // Build display services organized by category
  const { categories, standaloneServices } = useMemo(() => {
    if (!rawServices || !hierarchicalServices) return { categories: [], standaloneServices: [] };

    const boardUsageMap = new Map(
      boardServicesUsage?.map(bs => [bs.service_id, bs]) || []
    );

    const buildDisplayService = (service: any): DisplayService => {
      const boardUsage = boardUsageMap.get(service.id);
      
      if (hasBoardServices && boardUsage) {
        return {
          id: service.id,
          name: service.name,
          description: service.description || null,
          estimated_hours: service.estimated_hours || 0,
          price_cents: service.price_cents || 0,
          currentCount: boardUsage.currentCount || 0,
          monthlyLimit: boardUsage.monthly_limit || 0,
          remaining: boardUsage.remaining || 0,
          isLimitReached: boardUsage.isLimitReached || false,
        };
      }
      
      return {
        id: service.id,
        name: service.name,
        description: service.description || null,
        estimated_hours: service.estimated_hours || 0,
        price_cents: service.price_cents || 0,
        currentCount: 0,
        monthlyLimit: 0,
        remaining: Infinity,
        isLimitReached: false,
      };
    };

    const cats: { category: { id: string; name: string; description: string | null }; services: DisplayService[] }[] = [];
    const standalone: DisplayService[] = [];

    hierarchicalServices.forEach(service => {
      if (service.isCategory) {
        cats.push({
          category: {
            id: service.id,
            name: service.name,
            description: service.description,
          },
          services: service.children.map(child => buildDisplayService(child)),
        });
      } else {
        standalone.push(buildDisplayService(service));
      }
    });

    return { categories: cats, standaloneServices: standalone };
  }, [hierarchicalServices, rawServices, boardServicesUsage, hasBoardServices]);

  const handleRequestService = (serviceId: string) => {
    navigate(`/demands/request?serviceId=${serviceId}`);
  };

  const renderServiceCard = (service: DisplayService) => (
    <Card 
      key={service.id} 
      className={`flex flex-col transition-all hover:shadow-lg ${
        service.isLimitReached ? "opacity-60" : ""
      }`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg leading-tight">{service.name}</CardTitle>
          {service.price_cents > 0 ? (
            <Badge variant="secondary" className="shrink-0 text-base font-bold">
              {formatPrice(service.price_cents)}
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-sm">
              Gratuito
            </Badge>
          )}
        </div>
        {service.description && (
          <CardDescription className="line-clamp-3 mt-2">
            {service.description}
          </CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          <span>Prazo estimado: {service.estimated_hours} horas</span>
        </div>
        
        {hasBoardServices && (
          <div className="flex items-center gap-2 text-sm">
            {service.isLimitReached ? (
              <span className="flex items-center gap-1 text-destructive font-medium">
                <AlertTriangle className="h-4 w-4" />
                Limite atingido este mês
              </span>
            ) : service.monthlyLimit > 0 ? (
              <span className="text-muted-foreground">
                {service.remaining} de {service.monthlyLimit} disponíveis
              </span>
            ) : (
              <span className="flex items-center gap-1 text-muted-foreground">
                <InfinityIcon className="h-4 w-4" />
                Ilimitado
              </span>
            )}
          </div>
        )}
      </CardContent>
      
      <CardFooter className="pt-3 border-t">
        <Button 
          className="w-full" 
          disabled={service.isLimitReached}
          onClick={() => handleRequestService(service.id)}
        >
          <ShoppingCart className="mr-2 h-4 w-4" />
          {service.isLimitReached ? "Indisponível" : "Solicitar Serviço"}
        </Button>
      </CardFooter>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <SEOHead title="Loja" path="/store" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const hasAnyServices = categories.some(c => c.services.length > 0) || standaloneServices.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <SEOHead title="Loja" path="/store" />
      <PageBreadcrumb
        items={[
          { label: "Loja de Serviços", icon: ShoppingCart, isCurrent: true },
        ]}
      />
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <ShoppingCart className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Loja de Serviços</h1>
          <p className="text-muted-foreground">Solicite serviços disponíveis para sua equipe</p>
        </div>
      </div>

      {/* Services by Category */}
      {hasAnyServices ? (
        <div className="space-y-8">
          {/* Categories */}
          {categories.map(({ category, services }) => (
            services.length > 0 && (
              <div key={category.id} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 bg-primary/10 rounded-md">
                    <Folder className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{category.name}</h2>
                    {category.description && (
                      <p className="text-sm text-muted-foreground">{category.description}</p>
                    )}
                  </div>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {services.map(renderServiceCard)}
                </div>
              </div>
            )
          ))}

          {/* Standalone Services (without category) */}
          {standaloneServices.length > 0 && (
            <div className="space-y-4">
              {categories.length > 0 && (
                <h2 className="text-xl font-semibold">Outros Serviços</h2>
              )}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {standaloneServices.map(renderServiceCard)}
              </div>
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <Package className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Nenhum serviço disponível</h3>
            <p className="text-muted-foreground max-w-sm">
              Os administradores da equipe ainda não configuraram serviços para este quadro.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
