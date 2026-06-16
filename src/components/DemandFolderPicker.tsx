import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemandFolders, useAddDemandToFolder, useRemoveDemandFromFolder } from "@/hooks/useDemandFolders";
import { useAuth } from "@/lib/auth";
import { FolderOpen, Plus, X, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DemandFolderPickerProps {
  demandId: string;
  teamId: string;
  subdemandIds?: string[];
  canEdit?: boolean;
  variant?: "inline" | "button";
}

function useDemandFolderLinks(demandId: string | null) {
  return useQuery({
    queryKey: ["demand-folder-links", demandId],
    queryFn: async () => {
      if (!demandId) return [];
      const { data, error } = await supabase
        .from("project_demands")
        .select("project_id, projects(id, name, color)")
        .eq("demand_id", demandId);
      if (error) throw error;
      return (data || []).map((item: any) => ({
        folderId: item.project_id as string,
        name: item.projects?.name as string,
        color: item.projects?.color as string,
      }));
    },
    enabled: !!demandId,
  });
}

export function DemandFolderPicker({ demandId, teamId, subdemandIds, canEdit = false, variant = "inline" }: DemandFolderPickerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: linkedFolders } = useDemandFolderLinks(demandId);
  const { data: allFolders } = useDemandFolders(teamId, user?.id);
  const addToFolder = useAddDemandToFolder();
  const removeFromFolder = useRemoveDemandFromFolder();
  const [open, setOpen] = useState(false);

  const linkedFolderIds = useMemo(() => new Set((linkedFolders || []).map(f => f.folderId)), [linkedFolders]);

  const handleToggle = async (folderId: string) => {
    const isLinked = linkedFolderIds.has(folderId);

    if (isLinked) {
      // Remove
      removeFromFolder.mutate({ folder_id: folderId, demand_id: demandId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["demand-folder-links", demandId] });
        }
      });
      if (subdemandIds && subdemandIds.length > 0) {
        for (const subId of subdemandIds) {
          await supabase.from("project_demands").delete().eq("project_id", folderId).eq("demand_id", subId);
          queryClient.invalidateQueries({ queryKey: ["demand-folder-links", subId] });
        }
        queryClient.invalidateQueries({ queryKey: ["demand-folders"] });
      }
    } else {
      // Add
      addToFolder.mutate({ folder_id: folderId, demand_id: demandId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["demand-folder-links", demandId] });
          toast.success("Demanda vinculada ao projeto!");
        }
      });
      if (subdemandIds && subdemandIds.length > 0) {
        for (const subId of subdemandIds) {
          const { data: existing } = await supabase
            .from("project_demands").select("id").eq("project_id", folderId).eq("demand_id", subId).maybeSingle();
          if (!existing) {
            await supabase.from("project_demands").insert({ project_id: folderId, demand_id: subId });
            queryClient.invalidateQueries({ queryKey: ["demand-folder-links", subId] });
          }
        }
        queryClient.invalidateQueries({ queryKey: ["demand-folders"] });
        if (subdemandIds.length > 0) {
          toast.success(`${subdemandIds.length} subdemanda(s) também vinculada(s)!`);
        }
      }
    }
  };

  const folderCount = linkedFolders?.length || 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="flex-1 sm:flex-none gap-2">
          <FolderOpen className="h-4 w-4" />
          Pastas
          {folderCount > 0 && (
            <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px]">
              {folderCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="text-xs font-medium text-muted-foreground px-2 pb-2">Vincular a pastas</p>
        {allFolders && allFolders.length > 0 ? (
          <div className="space-y-0.5 max-h-56 overflow-y-auto">
            {allFolders.map(folder => {
              const isLinked = linkedFolderIds.has(folder.id);
              return (
                <button
                  key={folder.id}
                  onClick={() => canEdit && handleToggle(folder.id)}
                  disabled={!canEdit}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-sm text-left transition-colors",
                    canEdit ? "hover:bg-muted cursor-pointer" : "opacity-60 cursor-default",
                    isLinked && "bg-primary/5"
                  )}
                >
                  <FolderOpen className="h-4 w-4 flex-shrink-0" style={{ color: folder.color }} />
                  <span className="truncate flex-1">{folder.name}</span>
                  {isLinked && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground px-2 py-3 text-center">Nenhuma pasta disponível</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
