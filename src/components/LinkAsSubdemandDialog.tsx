import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemandsList } from "@/hooks/useDemandsList";
import { useConvertToSubdemand } from "@/hooks/useSubdemands";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";

interface LinkAsSubdemandDialogProps {
  open: boolean;
  onClose: () => void;
  demandId: string;
  boardId: string;
  demandTitle: string;
}

export function LinkAsSubdemandDialog({
  open,
  onClose,
  demandId,
  boardId,
  demandTitle,
}: LinkAsSubdemandDialogProps) {
  const { data: demands, isLoading } = useDemandsList(boardId);
  const convert = useConvertToSubdemand();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const options = useMemo(() => {
    return (demands || []).filter(
      (d) => d.id !== demandId && !d.parent_demand_id,
    );
  }, [demands, demandId]);

  const selected = options.find((o) => o.id === selectedId) || null;

  const handleClose = () => {
    setSelectedId(null);
    setPopoverOpen(false);
    onClose();
  };

  const handleConfirm = async () => {
    if (!selectedId) return;
    try {
      await convert.mutateAsync({ demandId, parentDemandId: selectedId, boardId });
      toast.success("Demanda vinculada como subdemanda");
      handleClose();
    } catch (err) {
      toast.error(getErrorMessage(err) || "Não foi possível vincular a demanda");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4 text-[#F28705]" />
            Vincular como subdemanda
          </DialogTitle>
          <DialogDescription className="text-xs">
            A demanda <span className="font-medium">"{demandTitle}"</span> passará a ser subdemanda da demanda selecionada. Você pode reverter depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <label className="text-sm font-medium">Demanda pai *</label>
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={popoverOpen}
                className="w-full justify-between h-9 font-normal"
                disabled={isLoading}
              >
                <span className="truncate text-left">
                  {selected
                    ? `#${selected.board_sequence_number} — ${selected.title}`
                    : isLoading
                    ? "Carregando..."
                    : "Selecione a demanda pai"}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command
                filter={(value, search) => {
                  return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
                }}
              >
                <CommandInput placeholder="Buscar por número ou título..." />
                <CommandList
                  className="max-h-[260px] overflow-y-auto overscroll-contain"
                  onWheel={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                >
                  <CommandEmpty>Nenhuma demanda disponível.</CommandEmpty>
                  <CommandGroup>
                    {options.map((d) => {
                      const label = `#${d.board_sequence_number} — ${d.title}`;
                      return (
                        <CommandItem
                          key={d.id}
                          value={label}
                          onSelect={() => {
                            setSelectedId(d.id);
                            setPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 shrink-0",
                              selectedId === d.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          <span className="truncate min-w-0">{label}</span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {!isLoading && options.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Não há outras demandas principais disponíveis neste quadro.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={handleClose} size="sm">
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedId || convert.isPending}
            size="sm"
            className="bg-[#F28705] text-white border border-transparent hover:bg-white hover:text-[#F28705] hover:border-[#F28705]"
          >
            {convert.isPending ? "Vinculando..." : "Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
