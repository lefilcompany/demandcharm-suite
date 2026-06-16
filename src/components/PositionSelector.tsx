import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TeamPosition } from "@/hooks/useTeamPositions";
import { Briefcase, X } from "lucide-react";

interface PositionSelectorProps {
  positions: TeamPosition[];
  value: string | null;
  onChange: (positionId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function PositionSelector({
  positions,
  value,
  onChange,
  disabled = false,
  placeholder = "Selecionar cargo",
}: PositionSelectorProps) {
  return (
    <Select
      value={value || "none"}
      onValueChange={(val) => onChange(val === "none" ? null : val)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder}>
          {value ? (
            <span className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: positions.find(p => p.id === value)?.color || "#6B7280" }}
              />
              {positions.find(p => p.id === value)?.name || placeholder}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <span className="flex items-center gap-2 text-muted-foreground">
            <X className="h-3 w-3" />
            Sem cargo
          </span>
        </SelectItem>
        {positions.map((position) => (
          <SelectItem key={position.id} value={position.id}>
            <span className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: position.color }}
              />
              {position.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
