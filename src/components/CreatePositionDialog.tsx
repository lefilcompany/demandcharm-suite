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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Cargo" : "Criar Cargo"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Altere as informações do cargo."
              : "Crie um novo cargo personalizado para sua equipe."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do cargo *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Desenvolvedor, Designer, Analista..."
              maxLength={50}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva as responsabilidades deste cargo..."
              rows={3}
              maxLength={255}
            />
          </div>

          <ColorPicker
            value={color}
            onChange={setColor}
            label="Cor do badge"
          />

          {/* Text Color Selection */}
          <div className="space-y-2">
            <Label>Cor do texto</Label>
            <RadioGroup value={textColor} onValueChange={setTextColor} className="flex gap-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="auto" id="auto" />
                <Label htmlFor="auto" className="cursor-pointer font-normal">Automático</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="light" id="light" />
                <Label htmlFor="light" className="cursor-pointer font-normal">Claro</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dark" id="dark" />
                <Label htmlFor="dark" className="cursor-pointer font-normal">Escuro</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div className="p-4 rounded-lg bg-muted/50 flex items-center justify-center">
              <PositionBadge name={name || "Cargo"} color={color} textColor={textColor} />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Salvar Alterações" : "Criar Cargo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
