import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { RichTextDisplay } from "@/components/ui/rich-text-editor";
import { InteractionAttachments } from "@/components/InteractionAttachments";
import { MentionInput } from "@/components/MentionInput";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Copy, MoreHorizontal, Pencil, Trash2, Wrench, ArrowRightLeft } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { copyRichContent } from "@/lib/clipboardUtils";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";

const SKIP_DELETE_CONFIRM_KEY = "skip-chat-delete-confirm";

interface ChatMessageProps {
  interaction: {
    id: string;
    content: string | null;
    interaction_type: string;
    created_at: string;
    user_id: string;
    metadata: any;
    profiles: { full_name: string; avatar_url: string | null } | null;
  };
  isGrouped: boolean;
  isOwnMessage: boolean;
  boardId: string;
  onEdit: (id: string, content: string) => void;
  onSaveEdit: (id: string, demandId: string, content: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  editingId: string | null;
  editingContent: string;
  onEditingContentChange: (content: string) => void;
  isSavingEdit: boolean;
  onNavigateUser: (userId: string) => void;
}

export function DemandChatMessage({
  interaction,
  isGrouped,
  isOwnMessage,
  boardId,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  editingId,
  editingContent,
  onEditingContentChange,
  isSavingEdit,
  onNavigateUser,
}: ChatMessageProps) {
  const [isHovered, setIsHovered] = useState(false);
  const isEditing = editingId === interaction.id;
  const isSystemMessage = interaction.interaction_type === "status_change";
  const isAdjustment = interaction.interaction_type === "adjustment_request";
  const canEdit = isOwnMessage && interaction.interaction_type === "comment";

  const metadata = interaction.metadata as { adjustment_type?: string } | null;
  const adjustmentType = metadata?.adjustment_type || "external";
  const isInternal = isAdjustment && adjustmentType === "internal";

  const createdAt = new Date(interaction.created_at);
  const timeStr = format(createdAt, "HH:mm");

  // System messages (status changes)
  if (isSystemMessage) {
    return (
      <div className="flex items-center justify-center gap-2 py-1.5">
        <div className="h-px flex-1 bg-border/50" />
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70 px-2">
          <ArrowRightLeft className="h-3 w-3" />
          <span>{interaction.content}</span>
          <span className="opacity-60">• {timeStr}</span>
        </div>
        <div className="h-px flex-1 bg-border/50" />
      </div>
    );
  }

  // Adjustment messages
  if (isAdjustment) {
    return (
      <div className={cn(
        "flex items-start gap-2.5 px-3 py-2 rounded-lg mx-2 border",
        isInternal 
          ? "bg-blue-500/5 border-blue-500/20" 
          : "bg-amber-500/5 border-amber-500/20"
      )}>
        <Wrench className={cn("h-4 w-4 mt-0.5 shrink-0", isInternal ? "text-blue-500" : "text-amber-500")} />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateUser(interaction.user_id)}
              className="text-xs font-semibold hover:text-primary hover:underline cursor-pointer transition-colors"
            >
              {interaction.profiles?.full_name}
            </button>
            <span className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded",
              isInternal ? "text-blue-600 bg-blue-500/15" : "text-amber-600 bg-amber-500/15"
            )}>
              {isInternal ? "Ajuste Interno" : "Ajuste Externo"}
            </span>
            <span className="text-[10px] text-muted-foreground/60">{timeStr}</span>
          </div>
          {interaction.content && (
            <RichTextDisplay content={interaction.content} className="text-xs text-foreground/80" />
          )}
        </div>
      </div>
    );
  }

  // Regular chat messages
  return (
    <div
      className={cn(
        "group relative flex gap-2.5 px-3 transition-colors",
        isGrouped ? "py-0.5" : "pt-3 pb-0.5",
        isHovered && "bg-muted/30"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar or spacer */}
      <div className="w-8 shrink-0 flex justify-center">
        {!isGrouped ? (
          <Avatar className="h-8 w-8">
            <AvatarImage src={interaction.profiles?.avatar_url || undefined} />
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {interaction.profiles?.full_name?.charAt(0) || "?"}
            </AvatarFallback>
          </Avatar>
        ) : (
          <span className="text-[10px] text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors leading-5 select-none">
            {timeStr}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <button
              type="button"
              onClick={() => onNavigateUser(interaction.user_id)}
              className="text-sm font-semibold hover:text-primary hover:underline cursor-pointer transition-colors"
            >
              {interaction.profiles?.full_name}
            </button>
            <span className="text-[10px] text-muted-foreground/60">
              {isToday(createdAt)
                ? `Hoje às ${timeStr}`
                : isYesterday(createdAt)
                  ? `Ontem às ${timeStr}`
                  : format(createdAt, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
        )}

        {isEditing ? (
          <div className="space-y-2 py-1">
            <MentionInput
              value={editingContent}
              onChange={onEditingContentChange}
              boardId={boardId}
              placeholder="Edite sua mensagem..."
              className="text-sm min-h-[60px]"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={() => onSaveEdit(interaction.id, "", editingContent)} disabled={isSavingEdit || !editingContent.trim()}>
                {isSavingEdit ? "Salvando..." : "Salvar"}
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            {interaction.content && (
              <RichTextDisplay content={interaction.content} className="text-sm leading-relaxed" />
            )}
            <InteractionAttachments interactionId={interaction.id} />
          </>
        )}
      </div>

      {/* Hover actions */}
      {isHovered && !isEditing && (
        <div className="absolute right-2 -top-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-0.5 bg-popover border rounded-md shadow-md p-0.5">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyRichContent(interaction.content || "")}>
              <Copy className="h-3 w-3" />
            </Button>
            {canEdit && (
              <>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(interaction.id, interaction.content || "")}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <ChatDeleteConfirm onConfirm={() => onDelete(interaction.id)}>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/20">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </ChatDeleteConfirm>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Date separator component
function ChatDeleteConfirm({ children, onConfirm }: { children: React.ReactNode; onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  const [dontAsk, setDontAsk] = useState(false);

  const handleDelete = () => {
    if (dontAsk) {
      localStorage.setItem(SKIP_DELETE_CONFIRM_KEY, "true");
    }
    setOpen(false);
    onConfirm();
  };

  const handleClick = (e: React.MouseEvent) => {
    if (localStorage.getItem(SKIP_DELETE_CONFIRM_KEY) === "true") {
      e.preventDefault();
      onConfirm();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild onClick={handleClick}>{children}</PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-auto p-3 max-w-[220px]">
        <p className="text-sm font-medium mb-1">Excluir mensagem?</p>
        <p className="text-xs text-muted-foreground mb-3">Esta ação é irreversível.</p>
        <div className="flex items-center gap-2 mb-3">
          <Checkbox id="skip-confirm" checked={dontAsk} onCheckedChange={(v) => setDontAsk(!!v)} />
          <label htmlFor="skip-confirm" className="text-xs text-muted-foreground cursor-pointer">Não perguntar novamente</label>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>Excluir</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DateSeparator({ date }: { date: Date }) {
  const label = isToday(date)
    ? "Hoje"
    : isYesterday(date)
      ? "Ontem"
      : format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="flex items-center gap-3 py-2 px-3">
      <div className="h-px flex-1 bg-border/50" />
      <span className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider">
        {label}
      </span>
      <div className="h-px flex-1 bg-border/50" />
    </div>
  );
}
