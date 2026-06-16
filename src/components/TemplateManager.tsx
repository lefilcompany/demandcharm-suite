import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Plus, Trash2 } from "lucide-react";
import { useTemplates, useCreateTemplate, useDeleteTemplate } from "@/hooks/useTemplates";
import { useServices } from "@/hooks/useServices";
import { toast } from "sonner";

interface TemplateManagerProps {
  teamId: string;
}

export function TemplateManager({ teamId }: TemplateManagerProps) {
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [titleTemplate, setTitleTemplate] = useState("");
  const [descriptionTemplate, setDescriptionTemplate] = useState("");
  const [priority, setPriority] = useState("média");
  const [serviceId, setServiceId] = useState<string>("");

  const { data: templates } = useTemplates(teamId);
  const { data: services } = useServices(teamId);
  const createTemplate = useCreateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const resetForm = () => {
    setName("");
    setTitleTemplate("");
    setDescriptionTemplate("");
    setPriority("média");
    setServiceId("");
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      await createTemplate.mutateAsync({
        team_id: teamId,
        name: name.trim(),
        title_template: titleTemplate || undefined,
        description_template: descriptionTemplate || undefined,
        priority,
        service_id: serviceId || undefined,
      });
      toast.success("Template criado");
      resetForm();
      setFormOpen(false);
    } catch {
      toast.error("Erro ao criar template");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTemplate.mutateAsync({ id, teamId });
      toast.success("Template removido");
    } catch {
      toast.error("Erro ao remover template");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="mr-2 h-4 w-4" />
          Gerenciar Templates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Templates de Demanda
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {templates && templates.length > 0 ? (
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div>
                    <p className="font-medium">{template.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {template.title_template && `Título: ${template.title_template}`}
                      {template.services?.name && ` • ${template.services.name}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Nenhum template criado
            </p>
          )}

          {!formOpen ? (
            <Button onClick={() => setFormOpen(true)} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Novo Template
            </Button>
          ) : (
            <div className="space-y-3 p-4 border rounded-lg">
              <Input
                placeholder="Nome do template"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                placeholder="Título padrão (opcional)"
                value={titleTemplate}
                onChange={(e) => setTitleTemplate(e.target.value)}
              />
              <RichTextEditor
                value={descriptionTemplate}
                onChange={setDescriptionTemplate}
                minHeight="100px"
                placeholder="Descrição padrão (opcional)"
              />
              <div className="grid grid-cols-2 gap-2">
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="média">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Serviço (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {services?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { resetForm(); setFormOpen(false); }}>
                  Cancelar
                </Button>
                <Button onClick={handleCreate} disabled={createTemplate.isPending}>
                  Criar Template
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
