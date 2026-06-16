import { useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { Bell, ChevronDown, Info, Search, X } from "lucide-react";
import { useBoardMembers } from "@/hooks/useBoardMembers";
import type { ApprovalKind } from "@/lib/approvalNotifications";

const ROLE_FILTER: Record<ApprovalKind, Set<string>> = {
  internal: new Set(["admin", "moderator"]),
  external: new Set(["requester"]),
};

const roleLabel = (r: string) =>
  r === "admin" ? "Administrador"
  : r === "moderator" ? "Coordenador"
  : r === "requester" ? "Solicitante"
  : r === "executor" ? "Agente"
  : r;

const roleBadgeClass = (r: string) =>
  r === "admin" ? "bg-orange-500/15 text-orange-700 border-orange-500/40"
  : r === "moderator" ? "bg-blue-500/15 text-blue-700 border-blue-500/40"
  : r === "requester" ? "bg-purple-500/15 text-purple-700 border-purple-500/40"
  : "";

interface Props {
  boardId: string | null | undefined;
  approvalType: ApprovalKind;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  label: string;
  tooltip: string;
}

export function ApprovalRecipientsSelector({
  boardId,
  approvalType,
  selectedIds,
  onChange,
  label,
  tooltip,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: members } = useBoardMembers(boardId ?? null);

  const eligible = useMemo(
    () => (members || []).filter((m) => ROLE_FILTER[approvalType].has(m.role)),
    [members, approvalType],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return eligible;
    return eligible.filter((m) => {
      const n = (m.profile?.full_name || "").toLowerCase();
      const e = (m.profile?.email || "").toLowerCase();
      return n.includes(q) || e.includes(q);
    });
  }, [eligible, search]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  };

  const summary =
    selectedIds.length === 0
      ? `Padrão (todos os ${approvalType === "internal" ? "administradores e coordenadores" : "solicitantes"})`
      : `${selectedIds.length} pessoa${selectedIds.length > 1 ? "s" : ""} selecionada${selectedIds.length > 1 ? "s" : ""}`;

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Bell className="h-4 w-4" />
        {label}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground">
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-full justify-between font-normal"
            disabled={!boardId}
          >
            <span className="truncate text-sm">{summary}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar membro..."
                className="h-8 pl-7"
              />
            </div>
          </div>
          <ScrollArea className="max-h-60">
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                Nenhum membro elegível
              </div>
            ) : (
              <ul className="p-1">
                {filtered.map((m) => {
                  const checked = selectedIds.includes(m.user_id);
                  const initials = (m.profile?.full_name || "?")
                    .split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
                  return (
                    <li key={m.user_id}>
                      <button
                        type="button"
                        onClick={() => toggle(m.user_id)}
                        className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-muted text-left"
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggle(m.user_id)} />
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={m.profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 text-sm truncate">
                          {m.profile?.full_name || m.profile?.email}
                        </span>
                        <Badge variant="outline" className={`text-[10px] ${roleBadgeClass(m.role)}`}>
                          {roleLabel(m.role)}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
          {selectedIds.length > 0 && (
            <div className="p-2 border-t flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {selectedIds.length} selecionado{selectedIds.length > 1 ? "s" : ""}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onChange([])}
              >
                <X className="h-3 w-3 mr-1" /> Limpar
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
