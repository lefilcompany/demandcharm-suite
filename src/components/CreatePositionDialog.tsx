import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ColorPicker } from "@/components/ColorPicker";
import { PositionBadge } from "@/components/PositionBadge";
import { Loader2 } from "lucide-react";
import { TeamPosition } from "@/hooks/useTeamPositions";

interface CreatePositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; description?: string; color: string; textColor: string }) => Promise<void>;
  isLoading?: boolean;
  editingPosition?: TeamPosition | null;
}

export function CreatePositionDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  editingPosition = null,
}: CreatePositionDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3B82F6");
  const [textColor, setTextColor] = useState("auto");

  // Reset form when dialog opens/closes or editing position changes
  useEffect(() => {
    if (open) {
      if (editingPosition) {
        setName(editingPosition.name);
        setDescription(editingPosition.description || "");
        setColor(editingPosition.color);
        setTextColor(editingPosition.text_color || "auto");
      } else {
        setName("");
        setDescription("");
        setColor("#3B82F6");
        setTextColor("auto");
      }
    }
  }, [open, editingPosition]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      textColor,
    });
  };

  const isEditing = !!editingPosition;

  const TEXT_OPTIONS = [
    { v: "auto", label: "Auto" },
    { v: "light", label: "Claro" },
    { v: "dark", label: "Escuro" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-1 border-b px-6 py-4 text-left">
          <DialogTitle>{isEditing ? "Editar performance" : "Criar performance"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Altere as informações da performance." : "Agrupe membros internos da equipe. Uma pessoa pode estar em várias."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto px-6 py-5 md:grid-cols-[1fr_15rem]">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Produto, Squad Mobile, Atendimento" maxLength={50} required autoFocus />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="description">Descrição</Label>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{description.length}/255</span>
                </div>
                <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Qual é o foco deste grupo?" rows={3} maxLength={255} className="resize-none" />
              </div>
              <ColorPicker value={color} onChange={setColor} label="Cor" />
            </div>

            <aside className="flex flex-col gap-4 rounded-xl bg-muted/50 p-4">
              <div className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prévia</span>
                <div className="flex min-h-20 items-center justify-center rounded-lg border bg-background px-3">
                  <PositionBadge name={name || "Performance"} color={color} textColor={textColor} />
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Cor do texto</span>
                <div className="grid grid-cols-3 gap-1 rounded-lg border bg-background p-1">
                  {TEXT_OPTIONS.map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setTextColor(o.v)}
                      className={`rounded-md px-1 py-1.5 text-xs font-medium transition-colors ${textColor === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              {description.trim() && (
                <p className="line-clamp-3 text-xs text-muted-foreground">{description}</p>
              )}
            </aside>
          </div>

          <DialogFooter className="border-t px-6 py-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar alterações" : "Criar performance"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
