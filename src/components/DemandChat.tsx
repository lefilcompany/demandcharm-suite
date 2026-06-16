import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DemandChatMessage, DateSeparator } from "@/components/DemandChatMessage";
import { DemandChatInput } from "@/components/DemandChatInput";
import { TypingIndicator } from "@/components/TypingIndicator";
import { useTypingIndicator } from "@/hooks/useTypingIndicator";
import { useDemandInteractions, useCreateInteraction, useUpdateInteraction, useDeleteInteraction } from "@/hooks/useDemands";
import { useUploadAttachment } from "@/hooks/useAttachments";
import { PendingFile, uploadPendingFiles } from "@/components/InlineFileUploader";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { cn } from "@/lib/utils";
import { Hash, Lock, ChevronDown, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { isSameDay } from "date-fns";
import { extractMentionedUserIds } from "@/lib/mentionUtils";
import { buildPublicDemandUrl } from "@/lib/demandShareUtils";
import { sendCommentPushNotification, sendMentionPushNotification } from "@/hooks/useSendPushNotification";
import { useSendEmail } from "@/hooks/useSendEmail";

interface DemandChatProps {
  demandId: string;
  boardId: string;
  boardRole: string | null;
  teamId: string;
  demandTitle: string;
  demandCreatedBy: string;
  assignees: { user_id: string }[];
  boardName?: string;
}

export function DemandChat({
  demandId,
  boardId,
  boardRole,
  teamId,
  demandTitle,
  demandCreatedBy,
  assignees,
  boardName,
}: DemandChatProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const sendEmail = useSendEmail();
  const isRequester = boardRole === "requester";
  const canSeeInternal = !isRequester;

  // Detect if all participants (creator + assignees) are internal members of this board.
  // If so, the "Geral" channel is hidden so requesters who later access the demand
  // (e.g. via shared link) cannot see internal discussion.
  const participantIds = useMemo(() => {
    const ids = new Set<string>();
    if (demandCreatedBy) ids.add(demandCreatedBy);
    assignees.forEach((a) => a.user_id && ids.add(a.user_id));
    return Array.from(ids);
  }, [demandCreatedBy, assignees]);

  const { data: allParticipantsInternal = false } = useQuery({
    queryKey: ["demand-chat-participants-internal", boardId, participantIds.sort().join(",")],
    queryFn: async () => {
      if (!boardId || participantIds.length === 0) return false;
      const { data, error } = await supabase
        .from("board_members")
        .select("user_id, role")
        .eq("board_id", boardId)
        .in("user_id", participantIds);
      if (error) throw error;
      // Every participant must be a board member AND not a requester
      if (!data || data.length < participantIds.length) return false;
      const roleByUser = new Map(data.map((m) => [m.user_id, m.role]));
      return participantIds.every((uid) => {
        const r = roleByUser.get(uid);
        return r && r !== "requester";
      });
    },
    enabled: !!boardId && participantIds.length > 0,
    staleTime: 60_000,
  });

  const internalOnly = allParticipantsInternal && canSeeInternal;
  const showGeneralTab = !internalOnly;

  const [channel, setChannel] = useState<"general" | "internal">(
    internalOnly ? "internal" : "general"
  );

  // Force channel to internal when demand becomes internal-only
  useEffect(() => {
    if (internalOnly && channel !== "internal") {
      setChannel("internal");
    }
  }, [internalOnly, channel]);

  const [comment, setComment] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef(true);
  const prevLengthRef = useRef(0);

  const { data: interactions } = useDemandInteractions(demandId, channel);
  const createInteraction = useCreateInteraction();
  const updateInteraction = useUpdateInteraction();
  const deleteInteraction = useDeleteInteraction();
  const uploadAttachment = useUploadAttachment();
  const { typingUsers, handleInputChange, stopTyping } = useTypingIndicator(demandId);

  // Sort ascending for chat
  const sortedInteractions = useMemo(() => {
    if (!interactions) return [];
    return [...interactions].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [interactions]);

  // Scroll to bottom within container only (avoid scrolling entire page)
  const scrollContainerToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  const scrollToBottom = scrollContainerToBottom;

  // Auto-scroll on new messages if near bottom
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollContainerToBottom("smooth");
    }
  }, [sortedInteractions, scrollContainerToBottom]);

  // Initial scroll to bottom on channel change or data load
  useEffect(() => {
    if (sortedInteractions.length > 0) {
      requestAnimationFrame(() => {
        scrollContainerToBottom("instant");
      });
    }
  }, [channel, scrollContainerToBottom]);

  // Scroll to bottom when interactions load for the first time
  
  useEffect(() => {
    if (sortedInteractions.length > 0 && prevLengthRef.current === 0) {
      requestAnimationFrame(() => {
        scrollContainerToBottom("instant");
      });
    }
    prevLengthRef.current = sortedInteractions.length;
  }, [sortedInteractions.length, scrollContainerToBottom]);

  // Auto-scroll when pending files change
  useEffect(() => {
    if (pendingFiles.length > 0) {
      setTimeout(() => scrollContainerToBottom("smooth"), 50);
    }
  }, [pendingFiles.length, scrollContainerToBottom]);

  // Track scroll position
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const threshold = 100;
    const isNear = target.scrollHeight - target.scrollTop - target.clientHeight < threshold;
    isNearBottomRef.current = isNear;
    setShowScrollBtn(!isNear);
  }, []);

  // Group messages
  const groupedMessages = useMemo(() => {
    const result: { interaction: typeof sortedInteractions[0]; isGrouped: boolean; showDateSep: boolean }[] = [];
    for (let i = 0; i < sortedInteractions.length; i++) {
      const curr = sortedInteractions[i];
      const prev = i > 0 ? sortedInteractions[i - 1] : null;
      
      const currDate = new Date(curr.created_at);
      const prevDate = prev ? new Date(prev.created_at) : null;
      const showDateSep = !prevDate || !isSameDay(currDate, prevDate);

      const isGrouped =
        !showDateSep &&
        !!prev &&
        prev.user_id === curr.user_id &&
        prev.interaction_type === "comment" &&
        curr.interaction_type === "comment" &&
        currDate.getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000;

      result.push({ interaction: curr, isGrouped, showDateSep });
    }
    return result;
  }, [sortedInteractions]);

  const handleSend = async () => {
    if (!comment.trim() || !demandId) return;
    setIsSending(true);
    let content = comment.trim();

    // Upload inline images
    if (content.includes("data:image")) {
      try {
        const { uploadInlineImages } = await import("@/lib/imageUploadUtils");
        content = await uploadInlineImages(content);
      } catch {
        content = content.replace(/<img\s+src="data:[^"]*"[^>]*\/?>/g, "[imagem não enviada]");
      }
    }

    createInteraction.mutate(
      {
        demand_id: demandId,
        interaction_type: "comment",
        content,
        channel,
      },
      {
        onSuccess: async (created) => {
          if (pendingFiles.length > 0 && created?.id) {
            const { success, failed } = await uploadPendingFiles(demandId, pendingFiles, uploadAttachment, created.id);
            if (failed > 0) toast.warning(`Mensagem enviada! ${success} arquivo(s), ${failed} falhou`);
            setPendingFiles([]);
          }
          setComment("");
          setIsSending(false);
          stopTyping();

          // Background notifications
          fireNotifications(content).catch(console.error);
        },
        onError: (err) => {
          setIsSending(false);
          toast.error("Erro ao enviar mensagem", { description: getErrorMessage(err) });
        },
      }
    );
  };

  const fireNotifications = async (content: string) => {
    if (!user?.id) return;
    const usersToNotify = new Set<string>();
    assignees.forEach((a) => usersToNotify.add(a.user_id));
    if (demandCreatedBy) usersToNotify.add(demandCreatedBy);
    usersToNotify.delete(user.id);
    const notifyIds = Array.from(usersToNotify);

    if (notifyIds.length > 0) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      const name = profile?.full_name || "Alguém";

      const notifications = notifyIds.map((uid) => ({
        user_id: uid,
        title: "Nova mensagem",
        message: `${name} enviou uma mensagem na demanda "${demandTitle}"`,
        type: "info",
        link: `/demands/${demandId}`,
      }));
      await supabase.from("notifications").insert(notifications);

      sendCommentPushNotification({
        userIds: notifyIds, demandId, demandTitle, commenterName: name, commentPreview: content,
      }).catch(console.error);

      const publicUrl = await buildPublicDemandUrl(demandId, user.id);
      for (const uid of notifyIds) {
        sendEmail.mutate({
          to: uid,
          subject: `💬 Nova mensagem em "${demandTitle}"`,
          template: "notification",
          templateData: {
            title: "Nova mensagem na demanda",
            message: `${name} enviou uma mensagem na demanda "${demandTitle}":\n\n"${content.substring(0, 200)}"`,
            actionUrl: publicUrl, actionText: "Ver demanda", type: "info",
          },
        });
      }
    }

    // Mentions - in-app notification + push + email
    const mentionedIds = extractMentionedUserIds(content).filter((id) => id !== user.id);
    if (mentionedIds.length > 0) {
      const { data: p } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      const mName = p?.full_name || "Alguém";

      const { data: eligibleMembers, error: eligibleMembersError } = await supabase
        .from("board_members")
        .select("user_id")
        .eq("board_id", boardId)
        .in("user_id", mentionedIds);

      if (eligibleMembersError) {
        console.error("Erro ao validar menções do quadro:", eligibleMembersError);
        return;
      }

      const eligibleMentionIds = Array.from(new Set((eligibleMembers || []).map((member) => member.user_id)));

      if (eligibleMentionIds.length === 0) {
        return;
      }

      const mentionNotifications = eligibleMentionIds.map((uid) => ({
        user_id: uid,
        title: "Você foi mencionado",
        message: `${mName} mencionou você na demanda "${demandTitle.substring(0, 100)}"`,
        type: "info",
        link: `/demands/${demandId}`,
      }));

      const { error: mentionInsertError } = await supabase.from("notifications").insert(mentionNotifications);
      if (mentionInsertError) {
        console.error("Erro ao criar notificações de menção:", mentionInsertError);
      }

      // FCM push for mentions
      for (const uid of eligibleMentionIds) {
        sendMentionPushNotification({ mentionedUserId: uid, demandId, demandTitle, mentionerName: mName, boardName }).catch(console.error);
      }

      // Send email to mentioned users
      const publicUrl = await buildPublicDemandUrl(demandId, user.id);
      for (const uid of eligibleMentionIds) {
        sendEmail.mutate({
          to: uid,
          subject: `💬 Você foi mencionado em "${demandTitle}"`,
          template: "notification",
          templateData: {
            title: "Você foi mencionado",
            message: `${mName} mencionou você na demanda "${demandTitle}":\n\n"${content.substring(0, 200)}"`,
            actionUrl: publicUrl, actionText: "Ver demanda", type: "info",
          },
        });
      }
    }
  };

  const handleEditSave = (interactionId: string) => {
    if (!editingContent.trim()) return;
    updateInteraction.mutate(
      { id: interactionId, demandId, content: editingContent.trim() },
      {
        onSuccess: () => { toast.success("Mensagem editada!"); setEditingId(null); setEditingContent(""); },
        onError: (err) => toast.error("Erro ao editar", { description: getErrorMessage(err) }),
      }
    );
  };

  const handleDelete = (interactionId: string) => {
    deleteInteraction.mutate(
      { id: interactionId, demandId },
      {
        onSuccess: () => toast.success("Mensagem excluída!"),
        onError: (err) => toast.error("Erro ao excluir", { description: getErrorMessage(err) }),
      }
    );
  };

  return (
    <div className="relative flex flex-col rounded-xl border border-border/60 bg-card shadow-sm min-h-[400px]" style={{ height: "min(700px, 70vh)" }}>
      {/* Channel tabs */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border/40 bg-muted/20">
        {showGeneralTab && (
          <button
            onClick={() => setChannel("general")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold tracking-wide uppercase transition-all",
              channel === "general"
                ? "bg-primary/10 text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <Hash className="h-3 w-3" />
            Geral
          </button>
        )}
        {canSeeInternal && (
          <button
            onClick={() => setChannel("internal")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold tracking-wide uppercase transition-all",
              channel === "internal"
                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm border border-blue-500/20"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
            title={internalOnly ? "Esta demanda só tem participantes internos — apenas o canal interno está disponível" : undefined}
          >
            <Lock className="h-3 w-3" />
            Interno
            
          </button>
        )}
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground/40 tabular-nums">
          {sortedInteractions.length} {sortedInteractions.length !== 1 ? "mensagens" : "mensagem"}
        </span>
      </div>

      {/* Messages area */}
      <div
        className={cn(
          "flex-1 min-h-0 overflow-y-auto",
          channel === "internal" && "bg-blue-500/[0.02]"
        )}
        ref={scrollRef}
        onScroll={handleScroll}
      >
        {groupedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="rounded-full bg-muted/50 p-4 mb-3">
              <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground/60 font-medium">
              {channel === "internal"
                ? "Nenhuma mensagem interna ainda"
                : "Nenhuma mensagem ainda"}
            </p>
            <p className="text-xs text-muted-foreground/40 mt-1">
              {channel === "internal"
                ? "Converse com a equipe de forma privada"
                : "Seja o primeiro a enviar uma mensagem!"}
            </p>
          </div>
        ) : (
          <div className="py-2">
            {groupedMessages.map(({ interaction, isGrouped, showDateSep }) => (
              <div key={interaction.id}>
                {showDateSep && <DateSeparator date={new Date(interaction.created_at)} />}
                <DemandChatMessage
                  interaction={interaction}
                  isGrouped={isGrouped}
                  isOwnMessage={interaction.user_id === user?.id}
                  boardId={boardId}
                  onEdit={(id, content) => { setEditingId(id); setEditingContent(content); }}
                  onSaveEdit={(id) => handleEditSave(id)}
                  onCancelEdit={() => { setEditingId(null); setEditingContent(""); }}
                  onDelete={handleDelete}
                  editingId={editingId}
                  editingContent={editingContent}
                  onEditingContentChange={setEditingContent}
                  isSavingEdit={updateInteraction.isPending}
                  onNavigateUser={(userId) => navigate(`/user/${userId}`)}
                />
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <Button
            size="icon"
            variant="secondary"
            className="absolute bottom-20 right-4 h-8 w-8 rounded-full shadow-lg z-10"
            onClick={() => scrollToBottom()}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-3 py-1 border-t border-border/30">
          <TypingIndicator users={typingUsers} />
        </div>
      )}

      {/* Input */}
      <DemandChatInput
        value={comment}
        onChange={setComment}
        onSend={handleSend}
        onInputChange={handleInputChange}
        onBlur={stopTyping}
        pendingFiles={pendingFiles}
        onFilesChange={setPendingFiles}
        isSending={isSending || createInteraction.isPending}
        boardId={boardId}
        channel={channel}
      />
    </div>
  );
}
