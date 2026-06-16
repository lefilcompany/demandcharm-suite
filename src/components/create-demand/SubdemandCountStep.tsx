import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Minus, Plus, GitBranch } from "lucide-react";

interface SubdemandCountStepProps {
  count: number;
  onChange: (count: number) => void;
}

export function SubdemandCountStep({ count, onChange }: SubdemandCountStepProps) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <GitBranch className="h-4 w-4" />
        Subdemandas
      </Label>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onChange(Math.max(0, count - 1))}
          disabled={count <= 0}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <div className="flex items-center justify-center min-w-[40px]">
          <span className="text-lg font-semibold">{count}</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => onChange(Math.min(20, count + 1))}
          disabled={count >= 20}
        >
          <Plus className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          {count === 0 ? "Nenhuma subdemanda" : count === 1 ? "1 subdemanda" : `${count} subdemandas`}
        </span>
      </div>
    </div>
  );
}
