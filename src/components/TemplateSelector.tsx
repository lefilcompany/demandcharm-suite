import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FileText, ChevronDown } from "lucide-react";
import { useTemplates } from "@/hooks/useTemplates";

interface TemplateSelectorProps {
  teamId: string | null;
  onSelect: (template: {
    title?: string;
    description?: string;
    priority?: string;
    service_id?: string;
  }) => void;
}

export function TemplateSelector({ teamId, onSelect }: TemplateSelectorProps) {
  const { data: templates, isLoading } = useTemplates(teamId);

  if (!teamId || isLoading || !templates || templates.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="mr-2 h-4 w-4" />
          Template
          <ChevronDown className="ml-2 h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {templates.map((template) => (
          <DropdownMenuItem
            key={template.id}
            onClick={() =>
              onSelect({
                title: template.title_template || undefined,
                description: template.description_template || undefined,
                priority: template.priority || undefined,
                service_id: template.service_id || undefined,
              })
            }
          >
            <FileText className="mr-2 h-4 w-4" />
            <div className="flex flex-col">
              <span>{template.name}</span>
              {template.services?.name && (
                <span className="text-xs text-muted-foreground">
                  {template.services.name}
                </span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
