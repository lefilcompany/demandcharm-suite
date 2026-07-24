import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  BoardScope,
  NotificationPreferences,
  useNotificationPreferences,
} from "@/hooks/useNotificationPreferences";
import { toast } from "sonner";

interface BoardRow {
  id: string;
  name: string;
  team_id: string;
}

interface Props {
  preferences: NotificationPreferences;
  onChange: (next: NotificationPreferences) => void;
  disabled?: boolean;
}

export function BoardScopeList({ preferences, onChange, disabled }: Props) {
  const { user } = useAuth();

  const { data: boards, isLoading } = useQuery({
    queryKey: ["notification-scope-boards", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as BoardRow[];
      const { data, error } = await supabase
        .from("boards")
        .select("id, name, team_id")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as BoardRow[];
    },
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const handleScope = (boardId: string, scope: BoardScope | "default") => {
    const nextScopes = { ...preferences.boardScopes };
    if (scope === "default") {
      delete nextScopes[boardId];
    } else {
      nextScopes[boardId] = scope;
    }
    onChange({ ...preferences, boardScopes: nextScopes });
    toast.success("Preferência do quadro atualizada");
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando quadros…
      </div>
    );
  }

  if (!boards || boards.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-2">
        Você ainda não faz parte de nenhum quadro.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {boards.map((b) => {
        const current: BoardScope | "default" = preferences.boardScopes[b.id] ?? "default";
        return (
          <div
            key={b.id}
            className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2"
          >
            <div className="min-w-0">
              <Label className="text-sm font-medium truncate block">{b.name}</Label>
              <p className="text-[11px] text-muted-foreground">
                {current === "default"
                  ? `Usando padrão (${preferences.defaultScope === "all" ? "Todas" : "Apenas minhas"})`
                  : current === "all"
                  ? "Todas as demandas"
                  : current === "assigned_only"
                  ? "Apenas onde sou responsável/acompanhante"
                  : "Silenciado"}
              </p>
            </div>
            <Select
              value={current}
              onValueChange={(v) => handleScope(b.id, v as BoardScope | "default")}
              disabled={disabled}
            >
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Usar padrão</SelectItem>
                <SelectItem value="all">Todas as demandas</SelectItem>
                <SelectItem value="assigned_only">Apenas as minhas</SelectItem>
                <SelectItem value="off">Silenciar quadro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}
