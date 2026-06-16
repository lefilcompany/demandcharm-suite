import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from "@/components/ui/sheet";
import { Settings2, Loader2, Cloud } from "lucide-react";
import { DashboardWidgets, DEFAULT_WIDGETS } from "@/hooks/useDashboardWidgets";

const WIDGET_LABELS: Record<keyof DashboardWidgets, string> = {
  aiInsights: "Análises de IA",
  productivitySection: "Seção de Produtividade",
  demandsSection: "Seção de Demandas",
  memberAnalysis: "Análise por Membro",
  recentActivities: "Atividades Recentes",
};

interface DashboardCustomizerProps {
  widgets: DashboardWidgets;
  onChange: (widgets: DashboardWidgets) => void;
  isSaving?: boolean;
}

export function DashboardCustomizer({ widgets, onChange, isSaving }: DashboardCustomizerProps) {
  const [open, setOpen] = useState(false);
  const [tempWidgets, setTempWidgets] = useState(widgets);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setTempWidgets(widgets);
    }
    setOpen(isOpen);
  };

  const handleSave = () => {
    onChange(tempWidgets);
    setOpen(false);
  };

  const handleReset = () => {
    setTempWidgets(DEFAULT_WIDGETS);
  };

  const handleToggle = (key: keyof DashboardWidgets) => {
    setTempWidgets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Settings2 className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Personalizar</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Personalizar Dashboard
            <Cloud className="h-4 w-4 text-muted-foreground" />
          </SheetTitle>
          <SheetDescription>
            Suas preferências são sincronizadas automaticamente entre dispositivos.
          </SheetDescription>
        </SheetHeader>
        
        <div className="py-6 space-y-4">
          {(Object.keys(WIDGET_LABELS) as Array<keyof DashboardWidgets>).map((key) => (
            <div key={key} className="flex items-center space-x-3">
              <Checkbox
                id={key}
                checked={tempWidgets[key]}
                onCheckedChange={() => handleToggle(key)}
              />
              <Label 
                htmlFor={key} 
                className="text-sm font-medium leading-none cursor-pointer"
              >
                {WIDGET_LABELS[key]}
              </Label>
            </div>
          ))}
        </div>

        <SheetFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handleReset} className="w-full sm:w-auto">
            Restaurar Padrão
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="w-full sm:w-auto gap-2">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export type { DashboardWidgets };
export { useDashboardWidgets } from "@/hooks/useDashboardWidgets";
