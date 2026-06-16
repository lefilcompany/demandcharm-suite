import { useState, useRef } from "react";
import { useSelectedBoardSafe } from "@/contexts/BoardContext";
import { useBoardRole } from "@/hooks/useBoardMembers";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, Loader2, ChevronDown, Check } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  moderator: "Coordenador",
  executor: "Agente",
  requester: "Solicitante",
};

const roleColors: Record<string, string> = {
  admin: "bg-red-500/10 text-red-500 border-red-500/20",
  moderator: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  executor: "bg-green-500/10 text-green-500 border-green-500/20",
  requester: "bg-purple-500/10 text-purple-500 border-purple-500/20",
};

const SKIP_CONFIRM_KEY = "skipBoardChangeConfirm";

export function BoardSelector() {
  const { boards, selectedBoardId, setSelectedBoardId, isLoading, currentBoard } =
    useSelectedBoardSafe();
  const { data: boardRole, isLoading: roleLoading } = useBoardRole(selectedBoardId);
  const navigate = useNavigate();
  const location = useLocation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const pendingBoardIdRef = useRef<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const isDemandDetail = /^\/demands\/[^/]+$/.test(location.pathname);

  const getReturnRoute = () => {
    const from = (location.state as any)?.from;
    if (from === "kanban") return "/kanban";
    if (from === "my-demands") return "/my-demands";
    if (from === "team-demands") return "/team-demands";
    if (from === "team-kanban") return "/team-kanban";
    return "/demands";
  };

  const executeChange = (newBoardId: string) => {
    setSelectedBoardId(newBoardId);
    if (isDemandDetail) {
      navigate(getReturnRoute());
    }
  };

  const handleBoardChange = (newBoardId: string) => {
    if (newBoardId === selectedBoardId) {
      setPopoverOpen(false);
      return;
    }
    setPopoverOpen(false);

    if (!isDemandDetail) {
      setSelectedBoardId(newBoardId);
      return;
    }

    const skipConfirm = localStorage.getItem(SKIP_CONFIRM_KEY) === "true";
    if (skipConfirm) {
      executeChange(newBoardId);
      return;
    }

    pendingBoardIdRef.current = newBoardId;
    setDontAskAgain(false);
    setDialogOpen(true);
  };

  const handleConfirm = () => {
    if (dontAskAgain) {
      localStorage.setItem(SKIP_CONFIRM_KEY, "true");
    }
    if (pendingBoardIdRef.current) {
      executeChange(pendingBoardIdRef.current);
      pendingBoardIdRef.current = null;
    }
    setDialogOpen(false);
  };

  const handleCancel = () => {
    pendingBoardIdRef.current = null;
    setDialogOpen(false);
  };

  if (isLoading) {
    return <Skeleton className="h-9 w-[180px]" />;
  }

  if (!boards || boards.length === 0) {
    return null;
  }

  const pendingBoard = boards?.find((b) => b.id === pendingBoardIdRef.current);

  return (
    <>
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    aria-expanded={popoverOpen}
                    className={cn(
                      "flex h-7 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-2 py-1 text-[11px] shadow-none sm:text-xs",
                      "max-w-[160px] sm:max-w-[240px] md:max-w-[300px]",
                      "hover:bg-muted transition-colors",
                      "focus-visible:outline-none focus-visible:border-ring focus-visible:[box-shadow:var(--focus-ring)]"
                    )}
                  >
                    <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                      <LayoutGrid className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate block">{currentBoard?.name || "Quadro"}</span>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              {currentBoard?.name && (
                <TooltipContent side="bottom" className="max-w-[320px] text-xs">
                  <p className="break-words">{currentBoard.name}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <PopoverContent
            align="start"
            className="w-[260px] p-0"
            onOpenAutoFocus={(e) => {
              // Let CommandInput receive focus naturally
              e.preventDefault();
            }}
          >
            <Command>
              <CommandInput placeholder="Buscar quadro..." className="h-9" />
              <CommandList>
                <CommandEmpty>Nenhum quadro encontrado.</CommandEmpty>
                <CommandGroup>
                  {boards.map((board) => {
                    const isSelected = board.id === selectedBoardId;
                    return (
                      <CommandItem
                        key={board.id}
                        value={board.name}
                        onSelect={() => handleBoardChange(board.id)}
                        className="flex items-start gap-2 data-[selected=true]:bg-muted data-[selected=true]:text-foreground"
                      >
                        <LayoutGrid className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                        <span className="flex-1 whitespace-normal break-words leading-snug">{board.name}</span>
                        <Check
                          className={cn(
                            "h-4 w-4 mt-0.5 shrink-0",
                            isSelected ? "opacity-100 text-primary" : "opacity-0"
                          )}
                        />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {roleLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground hidden sm:block" />
        ) : boardRole ? (
          <Badge variant="outline" className={`${roleColors[boardRole]} text-xs hidden sm:inline-flex`}>
            {roleLabels[boardRole]}
          </Badge>
        ) : null}
      </div>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mudar de quadro?</AlertDialogTitle>
            <AlertDialogDescription>
              Você será redirecionado ao sair desta demanda para o quadro
              {pendingBoard ? ` "${pendingBoard.name}"` : " selecionado"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              id="dontAskAgain"
              checked={dontAskAgain}
              onCheckedChange={(checked) => setDontAskAgain(checked === true)}
            />
            <label htmlFor="dontAskAgain" className="text-sm text-muted-foreground cursor-pointer select-none">
              Não perguntar novamente
            </label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Mudar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
