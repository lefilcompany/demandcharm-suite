import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { 
  FileText, 
  Users, 
  User, 
  LayoutDashboard, 
  Kanban, 
  Settings, 
  Plus,
  Archive,
  Search
} from "lucide-react";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { useSelectedBoardSafe } from "@/contexts/BoardContext";

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { currentBoard } = useSelectedBoardSafe();
  const { data: searchResults, isLoading } = useGlobalSearch(query, currentBoard?.id || null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  const quickActions = [
    { icon: Plus, label: "Nova Demanda", action: () => window.dispatchEvent(new CustomEvent("open-create-demand")) },
    { icon: LayoutDashboard, label: "Dashboard", action: () => navigate("/") },
    { icon: Kanban, label: "Kanban", action: () => navigate("/kanban") },
    { icon: FileText, label: "Demandas", action: () => navigate("/demands") },
    { icon: Users, label: "Equipes", action: () => navigate("/teams") },
    { icon: Archive, label: "Arquivadas", action: () => navigate("/archived") },
    { icon: Settings, label: "Configurações", action: () => navigate("/settings") },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case "demand": return FileText;
      case "team": return Users;
      case "member": return User;
      default: return Search;
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Buscar demandas, equipes, membros..." 
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading ? "Buscando..." : "Nenhum resultado encontrado."}
        </CommandEmpty>
        
        {searchResults && searchResults.length > 0 && (
          <CommandGroup heading="Resultados">
            {searchResults.map((result) => {
              const Icon = getIcon(result.type);
              return (
                <CommandItem
                  key={`${result.type}-${result.id}`}
                  onSelect={() => runCommand(() => navigate(result.link))}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <div className="flex flex-col">
                    <span>{result.title}</span>
                    {result.subtitle && (
                      <span className="text-xs text-muted-foreground">{result.subtitle}</span>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
        
        <CommandSeparator />
        
        <CommandGroup heading="Navegação Rápida">
          {quickActions.map((action) => (
            <CommandItem
              key={action.label}
              onSelect={() => runCommand(action.action)}
            >
              <action.icon className="mr-2 h-4 w-4" />
              <span>{action.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
