import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTeams } from "@/hooks/useTeams";
import {
  useHierarchicalServices,
  formatServiceHours,
  ServiceWithHierarchy,
} from "@/hooks/useServices";
import { SEOHead } from "@/components/SEOHead";
import {
  Clock,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Lock,
  Search,
  ShoppingBag,
  Users,
} from "lucide-react";

export default function ServicesManagement() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { data: hierarchicalServices, isLoading: servicesLoading } = useHierarchicalServices(id || null);

  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const team = teams?.find((t) => t.id === id);

  const toggleCategory = (categoryId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const term = search.trim().toLowerCase();
  const matches = (s: ServiceWithHierarchy) =>
    !term ||
    s.name.toLowerCase().includes(term) ||
    (s.description || "").toLowerCase().includes(term);

  const renderServiceRow = (service: ServiceWithHierarchy) => (
    <div
      key={service.id}
      className="flex items-start gap-3 px-3 py-2.5 rounded-lg border bg-card"
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{service.name}</p>
        {service.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>
        )}
      </div>
      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 pt-0.5">
        <Clock className="h-3 w-3" />
        <span className="whitespace-nowrap">{formatServiceHours(service)}</span>
      </div>
    </div>
  );

  if (teamsLoading || servicesLoading) {
    return (
      <div className="space-y-6">
        <SEOHead title="Catálogo de Serviços" path="/services" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <SEOHead title="Catálogo de Serviços" path="/services" />
        <h2 className="text-xl font-semibold">Equipe não encontrada</h2>
        <Button onClick={() => navigate("/teams")} className="mt-4">
          Voltar para Equipes
        </Button>
      </div>
    );
  }

  const categories = (hierarchicalServices || [])
    .filter((s) => s.isCategory)
    .map((c) => ({ ...c, children: c.children.filter(matches) }))
    .filter((c) => c.children.length > 0 || (!term && c.children.length === 0));
  const standalone = (hierarchicalServices || []).filter((s) => !s.isCategory).filter(matches);
  const hasAny = categories.length > 0 || standalone.length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <SEOHead title="Catálogo de Serviços" path="/services" />
      <PageBreadcrumb
        items={[
          { label: "Equipes", href: "/teams", icon: Users },
          { label: team.name, href: `/teams/${team.id}` },
          { label: "Serviços", icon: ShoppingBag },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Catálogo de Serviços
            <Badge variant="secondary" className="gap-1 font-normal">
              <Lock className="h-3 w-3" />
              Somente leitura
            </Badge>
          </h1>
          <p className="text-sm text-muted-foreground">
            Lista oficial de serviços do SoMA. As horas são referências de esforço, não prazos.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar serviço..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {hasAny ? (
        <div className="space-y-3">
          {categories.map((category) => {
            const isOpen = !collapsed.has(category.id) || !!term;
            return (
              <Collapsible
                key={category.id}
                open={isOpen}
                onOpenChange={() => toggleCategory(category.id)}
                className="rounded-xl border bg-card/50"
              >
                <CollapsibleTrigger className="w-full flex items-center gap-2 px-4 py-3 text-left">
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  {isOpen ? (
                    <FolderOpen className="h-4 w-4 text-primary" />
                  ) : (
                    <Folder className="h-4 w-4 text-primary" />
                  )}
                  <span className="font-semibold text-sm flex-1">{category.name}</span>
                  <Badge variant="outline" className="font-normal">
                    {category.children.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-3 space-y-1.5">
                    {category.children.map((child) => renderServiceRow(child))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}

          {standalone.length > 0 && (
            <div className="space-y-1.5 rounded-xl border border-dashed p-3">
              {categories.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 pb-1">
                  Outros serviços
                </p>
              )}
              {standalone.map((service) => renderServiceRow(service))}
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              {term ? "Nenhum serviço encontrado para essa busca." : "Nenhum serviço disponível."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
