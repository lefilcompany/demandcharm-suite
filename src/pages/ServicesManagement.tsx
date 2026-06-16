import { useState, useRef, DragEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { usePlanLimitGuard } from "@/hooks/usePlanLimitCheck";
import { getErrorMessage } from "@/lib/errorUtils";
import { formatPrice, parsePriceToCents, centsToDecimal } from "@/lib/priceUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTeams } from "@/hooks/useTeams";
import {
  useHierarchicalServices,
  useCreateService,
  useUpdateService,
  useDeleteService,
  ServiceWithHierarchy,
} from "@/hooks/useServices";
import { useIsTeamAdmin } from "@/hooks/useTeamRole";
import { SEOHead } from "@/components/SEOHead";
import {
  Plus,
  Clock,
  Pencil,
  Trash2,
  DollarSign,
  Folder,
  FolderPlus,
  ChevronDown,
  ChevronRight,
  Users,
  ShoppingBag,
  GripVertical,
  FolderOpen,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ServicesManagement() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: teams, isLoading: teamsLoading } = useTeams();
  const { data: hierarchicalServices, isLoading: servicesLoading } = useHierarchicalServices(id || null);
  const { isAdmin } = useIsTeamAdmin(id || null);
  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();

  // Dialog states
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<{
    id: string;
    name: string;
    description: string;
    estimated_hours: number;
    price_cents: number;
    parent_id: string | null;
  } | null>(null);
  const [serviceForm, setServiceForm] = useState({
    name: "",
    description: "",
    estimated_hours: 24,
    price: "0,00",
    parent_id: null as string | null,
  });
  const [folderForm, setFolderForm] = useState({ name: "", description: "" });
  const [editingFolder, setEditingFolder] = useState<{ id: string; name: string; description: string } | null>(null);

  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);
  const draggedServiceRef = useRef<string | null>(null);

  const folders = hierarchicalServices?.filter(s => s.isCategory && s.id !== editingService?.id) || [];
  const team = teams?.find((t) => t.id === id);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  // --- Service dialog ---
  const guardServices = usePlanLimitGuard("services");
  const openServiceDialog = async (service?: typeof editingService) => {
    if (service) {
      setEditingService(service);
      setServiceForm({
        name: service.name,
        description: service.description || "",
        estimated_hours: service.estimated_hours,
        price: centsToDecimal(service.price_cents || 0),
        parent_id: service.parent_id,
      });
      setServiceDialogOpen(true);
      return;
    }
    const ok = await guardServices();
    if (!ok) return;
    setEditingService(null);
    setServiceForm({ name: "", description: "", estimated_hours: 24, price: "0,00", parent_id: null });
    setServiceDialogOpen(true);
  };


  const handleServiceSubmit = () => {
    if (!serviceForm.name.trim() || !id) return;
    const priceCents = parsePriceToCents(serviceForm.price);

    if (editingService) {
      updateService.mutate(
        {
          id: editingService.id,
          team_id: id,
          name: serviceForm.name.trim(),
          description: serviceForm.description.trim() || undefined,
          estimated_hours: serviceForm.estimated_hours,
          price_cents: priceCents,
          parent_id: serviceForm.parent_id,
        },
        {
          onSuccess: () => {
            toast.success("Serviço atualizado!");
            setServiceDialogOpen(false);
            setEditingService(null);
          },
          onError: (error: any) => toast.error("Erro ao atualizar", { description: getErrorMessage(error) }),
        }
      );
    } else {
      createService.mutate(
        {
          name: serviceForm.name.trim(),
          description: serviceForm.description.trim() || undefined,
          team_id: id,
          estimated_hours: serviceForm.estimated_hours,
          price_cents: priceCents,
          parent_id: serviceForm.parent_id,
        },
        {
          onSuccess: () => {
            toast.success("Serviço criado!");
            setServiceDialogOpen(false);
          },
          onError: (error: any) => toast.error("Erro ao criar", { description: getErrorMessage(error) }),
        }
      );
    }
  };

  // --- Folder dialog ---
  const openFolderDialog = (folder?: { id: string; name: string; description: string }) => {
    if (folder) {
      setEditingFolder(folder);
      setFolderForm({ name: folder.name, description: folder.description || "" });
    } else {
      setEditingFolder(null);
      setFolderForm({ name: "", description: "" });
    }
    setFolderDialogOpen(true);
  };

  const handleFolderSubmit = () => {
    if (!folderForm.name.trim() || !id) return;

    if (editingFolder) {
      updateService.mutate(
        {
          id: editingFolder.id,
          team_id: id,
          name: folderForm.name.trim(),
          description: folderForm.description.trim() || undefined,
        },
        {
          onSuccess: () => {
            toast.success("Pasta atualizada!");
            setFolderDialogOpen(false);
            setEditingFolder(null);
          },
          onError: (error: any) => toast.error("Erro ao atualizar", { description: getErrorMessage(error) }),
        }
      );
    } else {
      // Create a folder: a service with no parent that will become a category
      createService.mutate(
        {
          name: folderForm.name.trim(),
          description: folderForm.description.trim() || undefined,
          team_id: id,
          estimated_hours: 0,
          price_cents: 0,
        },
        {
          onSuccess: () => {
            toast.success("Pasta criada!");
            setFolderDialogOpen(false);
          },
          onError: (error: any) => toast.error("Erro ao criar pasta", { description: getErrorMessage(error) }),
        }
      );
    }
  };

  const handleDelete = (serviceId: string, serviceName: string) => {
    if (!id) return;
    deleteService.mutate(
      { id: serviceId, team_id: id },
      {
        onSuccess: () => toast.success(`"${serviceName}" excluído!`),
        onError: (error: any) => toast.error("Erro ao excluir", { description: getErrorMessage(error) }),
      }
    );
  };

  // --- Drag and drop ---
  const handleDragStart = (e: DragEvent, serviceId: string) => {
    draggedServiceRef.current = serviceId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", serviceId);
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDropOnFolder = (e: DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverFolder(null);
    const serviceId = draggedServiceRef.current;
    if (!serviceId || serviceId === folderId || !id) return;

    updateService.mutate(
      { id: serviceId, team_id: id, parent_id: folderId },
      {
        onSuccess: () => {
          toast.success("Serviço movido para a pasta!");
          setExpandedCategories((prev) => new Set([...prev, folderId]));
        },
        onError: (error: any) => toast.error("Erro ao mover", { description: getErrorMessage(error) }),
      }
    );
    draggedServiceRef.current = null;
  };

  const handleDropOnRoot = (e: DragEvent) => {
    e.preventDefault();
    setDragOverRoot(false);
    const serviceId = draggedServiceRef.current;
    if (!serviceId || !id) return;

    updateService.mutate(
      { id: serviceId, team_id: id, parent_id: null },
      {
        onSuccess: () => toast.success("Serviço movido para raiz!"),
        onError: (error: any) => toast.error("Erro ao mover", { description: getErrorMessage(error) }),
      }
    );
    draggedServiceRef.current = null;
  };

  // --- Render helpers ---
  const renderServiceRow = (service: ServiceWithHierarchy, isChild = false) => (
    <div
      key={service.id}
      draggable={!service.isCategory}
      onDragStart={(e) => !service.isCategory && handleDragStart(e, service.id)}
      className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card transition-all
        ${isChild ? "ml-6 border-l-2 border-l-primary/20" : ""}
        ${!service.isCategory ? "cursor-grab active:cursor-grabbing hover:shadow-sm" : ""}
      `}
    >
      {!service.isCategory && (
        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      )}

      <div className="flex-1 min-w-0 flex items-center gap-3">
        <span className="font-medium text-sm truncate">{service.name}</span>
        {service.description && (
          <span className="text-xs text-muted-foreground truncate hidden sm:inline">
            {service.description}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{service.estimated_hours}h</span>
        </div>
        <div className="flex items-center gap-1">
          <DollarSign className="h-3 w-3" />
          <span>{formatPrice(service.price_cents || 0)}</span>
        </div>
      </div>

      <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() =>
            openServiceDialog({
              id: service.id,
              name: service.name,
              description: service.description || "",
              estimated_hours: service.estimated_hours,
              price_cents: service.price_cents || 0,
              parent_id: service.parent_id,
            })
          }
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir serviço?</AlertDialogTitle>
                <AlertDialogDescription>
                  Tem certeza que deseja excluir "{service.name}"? Esta ação não pode ser desfeita.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleDelete(service.id, service.name)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );

  if (teamsLoading || servicesLoading) {
    return (
      <div className="space-y-6">
        <SEOHead title="Gerenciar Serviços" path="/services" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="text-center py-12">
        <SEOHead title="Gerenciar Serviços" path="/services" />
        <h2 className="text-xl font-semibold">Equipe não encontrada</h2>
        <Button onClick={() => navigate("/teams")} className="mt-4">
          Voltar para Equipes
        </Button>
      </div>
    );
  }

  const categories = hierarchicalServices?.filter((s) => s.isCategory) || [];
  const standalone = hierarchicalServices?.filter((s) => !s.isCategory) || [];
  const hasAny = (hierarchicalServices?.length || 0) > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <SEOHead title="Gerenciar Serviços" path="/services" />
      <PageBreadcrumb
        items={[
          { label: team?.name || "", href: `/teams/${id}` },
          { label: "Serviços", icon: ShoppingBag, isCurrent: true },
        ]}
      />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Serviços</h1>
          <p className="text-sm text-muted-foreground">{team.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => openFolderDialog()} size="sm">
            <FolderPlus className="mr-2 h-4 w-4" />
            Nova Pasta
          </Button>
          <Button onClick={() => openServiceDialog()} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Novo Serviço
          </Button>
        </div>
      </div>

      {/* Content */}
      {hasAny ? (
        <div className="space-y-4">
          {/* Folders */}
          {categories.map((category) => (
            <div
              key={category.id}
              onDragOver={handleDragOver}
              onDragEnter={() => setDragOverFolder(category.id)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverFolder(null);
                }
              }}
              onDrop={(e) => handleDropOnFolder(e, category.id)}
              className={`rounded-xl border-2 transition-all duration-200 ${
                dragOverFolder === category.id
                  ? "border-primary bg-primary/5 shadow-md"
                  : "border-border bg-card/50"
              }`}
            >
              <Collapsible
                open={expandedCategories.has(category.id)}
                onOpenChange={() => toggleCategory(category.id)}
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                      {expandedCategories.has(category.id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      {expandedCategories.has(category.id) ? (
                        <FolderOpen className="h-4.5 w-4.5 text-primary" />
                      ) : (
                        <Folder className="h-4.5 w-4.5 text-primary" />
                      )}
                      <span className="font-semibold text-sm">{category.name}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                        {category.children.length}
                      </Badge>
                    </button>
                  </CollapsibleTrigger>

                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() =>
                        openFolderDialog({
                          id: category.id,
                          name: category.name,
                          description: category.description || "",
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {isAdmin && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir pasta?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Tem certeza que deseja excluir a pasta "{category.name}"?
                              {category.children.length > 0 && (
                                <span className="block mt-2 text-destructive font-medium">
                                  Esta pasta contém {category.children.length} serviço(s) que ficarão independentes.
                                </span>
                              )}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(category.id, category.name)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                <CollapsibleContent>
                  <div className="px-4 pb-3 space-y-1.5">
                    {category.children.length > 0 ? (
                      category.children.map((child) => renderServiceRow(child, true))
                    ) : (
                      <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
                        Arraste serviços para esta pasta
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          ))}

          {/* Standalone services */}
          {standalone.length > 0 && (
            <div
              className={`space-y-1.5 rounded-xl p-3 transition-all duration-200 ${
                dragOverRoot
                  ? "border-2 border-dashed border-primary bg-primary/5"
                  : categories.length > 0
                  ? "border-2 border-dashed border-border"
                  : ""
              }`}
              onDragOver={handleDragOver}
              onDragEnter={() => setDragOverRoot(true)}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverRoot(false);
                }
              }}
              onDrop={handleDropOnRoot}
            >
              {categories.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 pb-1">
                  Serviços independentes
                </p>
              )}
              {standalone.map((service) => renderServiceRow(service))}
            </div>
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <ShoppingBag className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground">Nenhum serviço cadastrado ainda.</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => openFolderDialog()}>
                <FolderPlus className="mr-2 h-4 w-4" />
                Criar Pasta
              </Button>
              <Button onClick={() => openServiceDialog()}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Serviço
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service Dialog */}
      <Dialog open={serviceDialogOpen} onOpenChange={setServiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingService ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
            <DialogDescription>
              {editingService ? "Atualize as informações do serviço" : "Crie um novo serviço para a equipe"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="svc-name">Nome *</Label>
              <Input
                id="svc-name"
                placeholder="Ex: Desenvolvimento de Sistema"
                value={serviceForm.name}
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-desc">Descrição</Label>
              <Textarea
                id="svc-desc"
                placeholder="Descrição do serviço..."
                value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="svc-hours">Prazo (horas) *</Label>
                <Input
                  id="svc-hours"
                  type="number"
                  min={1}
                  value={serviceForm.estimated_hours}
                  onChange={(e) =>
                    setServiceForm({ ...serviceForm, estimated_hours: parseInt(e.target.value) || 1 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="svc-price">Preço (R$)</Label>
                <Input
                  id="svc-price"
                  placeholder="0,00"
                  value={serviceForm.price}
                  onChange={(e) => setServiceForm({ ...serviceForm, price: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pasta</Label>
              <Select
                value={serviceForm.parent_id || "none"}
                onValueChange={(value) =>
                  setServiceForm({ ...serviceForm, parent_id: value === "none" ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sem pasta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem pasta (independente)</SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <div className="flex items-center gap-2">
                        <Folder className="h-3.5 w-3.5" />
                        {folder.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setServiceDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleServiceSubmit}
              disabled={!serviceForm.name.trim() || createService.isPending || updateService.isPending}
            >
              {createService.isPending || updateService.isPending
                ? "Salvando..."
                : editingService
                ? "Salvar"
                : "Criar Serviço"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5 text-primary" />
              {editingFolder ? "Editar Pasta" : "Nova Pasta"}
            </DialogTitle>
            <DialogDescription>
              {editingFolder
                ? "Atualize o nome da pasta"
                : "Crie uma pasta para organizar serviços relacionados"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name">Nome da Pasta *</Label>
              <Input
                id="folder-name"
                placeholder="Ex: Conteúdo, Tecnologia, Marketing"
                value={folderForm.name}
                onChange={(e) => setFolderForm({ ...folderForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folder-desc">Descrição</Label>
              <Textarea
                id="folder-desc"
                placeholder="Descrição opcional..."
                value={folderForm.description}
                onChange={(e) => setFolderForm({ ...folderForm, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleFolderSubmit}
              disabled={!folderForm.name.trim() || createService.isPending || updateService.isPending}
            >
              {createService.isPending || updateService.isPending
                ? "Salvando..."
                : editingFolder
                ? "Salvar"
                : "Criar Pasta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
