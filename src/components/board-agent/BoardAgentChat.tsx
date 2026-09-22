import { useCallback, useEffect, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, isToolUIPart, type UIMessage } from "ai";
import { AlertCircle, RotateCcw, MessageSquarePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, type PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { BoardAgentToolPart } from "@/components/board-agent/BoardAgentToolPart";
import { clearBoardAgentMessages, loadBoardAgentMessages, saveBoardAgentMessages } from "@/lib/boardAgent/storage";
import { cn } from "@/lib/utils";
import somaIcon from "@/assets/logo-soma-icon.png";

const SUGGESTIONS = [
  "Quantas demandas estão abertas?",
  "Quais demandas estão vencidas?",
  "Quantas foram entregues este mês, no prazo e com atraso?",
  "O que está aguardando aprovação?",
  "Como está a carga de trabalho por responsável?",
  "Quanto ainda posso criar do limite mensal?",
];

type Props = {
  boardId: string;
  boardName: string;
};

function thinkingMessage(isStreaming: boolean, duration?: number) {
  if (isStreaming || duration === 0) return <Shimmer duration={1}>Pensando...</Shimmer>;
  if (duration === undefined) return <p>Raciocínio</p>;
  return <p>Pensou por {duration} segundo{duration === 1 ? "" : "s"}</p>;
}

// Erros não-stream chegam como texto bruto (às vezes JSON {"error": "..."}); extrai a mensagem legível.
function readableError(error: Error): string {
  const raw = error.message?.trim() ?? "";
  if (!raw) return "Tente novamente em instantes.";
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as { error?: unknown; message?: unknown };
      const msg = typeof parsed.error === "string" ? parsed.error : typeof parsed.message === "string" ? parsed.message : "";
      if (msg) return msg;
    } catch {
      // segue com o texto bruto
    }
  }
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return "Sem conexão com o assistente. Verifique sua internet e tente novamente.";
  }
  return raw;
}

export function BoardAgentChat({ boardId, boardName }: Props) {
  const composerRef = useRef<HTMLDivElement>(null);
  const initialMessages = useMemo(() => loadBoardAgentMessages(boardId), [boardId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/board-agent`,
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token ?? "";
          return {
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
          };
        },
        body: () => ({
          boardId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      }),
    [boardId],
  );

  const { messages, sendMessage, status, error, regenerate, stop, setMessages, clearError } = useChat({
    id: `board-agent-${boardId}`,
    messages: initialMessages,
    transport,
  });

  const isBusy = status === "submitted" || status === "streaming";

  const focusComposer = useCallback(() => {
    const el = composerRef.current?.querySelector("textarea");
    if (el && document.activeElement !== el) el.focus();
  }, []);

  // Persiste a conversa deste quadro quando a resposta termina (ou falha).
  useEffect(() => {
    if (status === "ready" || status === "error") {
      saveBoardAgentMessages(boardId, messages);
    }
  }, [messages, status, boardId]);

  useEffect(() => {
    focusComposer();
  }, [focusComposer, boardId]);

  useEffect(() => {
    if (status === "ready") focusComposer();
  }, [status, focusComposer]);

  const ask = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isBusy) return;
      clearError();
      void sendMessage({ text: trimmed });
      requestAnimationFrame(focusComposer);
    },
    [isBusy, sendMessage, clearError, focusComposer],
  );

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      ask(message.text ?? "");
    },
    [ask],
  );

  const startNewConversation = useCallback(() => {
    if (isBusy) stop();
    setMessages([]);
    clearError();
    clearBoardAgentMessages(boardId);
    requestAnimationFrame(focusComposer);
  }, [isBusy, stop, setMessages, clearError, boardId, focusComposer]);

  const lastMessage = messages[messages.length - 1];
  const showThinking =
    status === "submitted" ||
    (status === "streaming" &&
      lastMessage?.role === "assistant" &&
      !lastMessage.parts.some((p) => p.type === "text" && p.text.trim().length > 0));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-3 py-4 sm:px-4">
          {messages.length === 0 ? (
            <EmptyState boardName={boardName} onPick={ask} disabled={isBusy} />
          ) : (
            messages.map((message) => <ChatMessage key={message.id} message={message} isStreaming={status === "streaming" && message.id === lastMessage?.id} />)
          )}

          {showThinking && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer className="text-sm text-muted-foreground" duration={1.6}>
                  Consultando o quadro...
                </Shimmer>
              </MessageContent>
            </Message>
          )}

          {error && (
            <div
              role="alert"
              className="mx-auto flex w-full max-w-3xl items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Não foi possível responder</p>
                <p className="text-destructive/90">{readableError(error)}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="shrink-0 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
                onClick={() => {
                  clearError();
                  void regenerate();
                }}
              >
                <RotateCcw className="size-3.5" />
                Tentar novamente
              </Button>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 border-t border-border/60 bg-background/95 px-3 pb-3 pt-2 backdrop-blur sm:px-4" ref={composerRef}>
        <div className="mx-auto w-full max-w-3xl space-y-2">
          {messages.length > 0 && !isBusy && (
            <Suggestions className="pb-0.5">
              {SUGGESTIONS.slice(0, 4).map((s) => (
                <Suggestion key={s} suggestion={s} onClick={ask} className="h-7 text-xs" />
              ))}
            </Suggestions>
          )}
          <PromptInput onSubmit={handleSubmit} className="rounded-xl border-border shadow-sm">
            <PromptInputTextarea
              placeholder={`Pergunte sobre o quadro ${boardName}…`}
              disabled={isBusy}
              className="min-h-[52px] text-sm"
            />
            <PromptInputFooter className="justify-between">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={startNewConversation}
                  disabled={messages.length === 0 && !error}
                >
                  <MessageSquarePlus className="size-3.5" />
                  Nova conversa
                </Button>
              </div>
              <PromptInputSubmit status={isBusy ? status : undefined} onStop={stop} className="size-8 rounded-lg" />
            </PromptInputFooter>
          </PromptInput>
          <p className="px-1 text-center text-[11px] text-muted-foreground">
            As respostas usam os dados reais do quadro. Confira números críticos no Kanban antes de decidir.
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ boardName, onPick, disabled }: { boardName: string; onPick: (s: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-col items-center gap-6 px-2 pt-10 text-center sm:pt-16">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-sidebar shadow-lg shadow-sidebar/30">
        <img src={somaIcon} alt="SoMA+" className="size-9" />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold tracking-tight">Pergunte sobre o quadro {boardName}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Abertas, entregues, vencidas, no prazo ou com atraso, solicitações pendentes, carga por responsável — respondo com os números atuais do quadro.
        </p>
      </div>
      <div className="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className={cn(
              "rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground shadow-sm transition-colors",
              "hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50",
            )}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatMessage({ message, isStreaming }: { message: UIMessage; isStreaming: boolean }) {
  if (message.role === "user") {
    const text = message.parts
      .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
      .map((p) => p.text)
      .join("\n");
    return (
      <Message from="user">
        <MessageContent className="group-[.is-user]:bg-primary group-[.is-user]:text-primary-foreground group-[.is-user]:rounded-2xl group-[.is-user]:rounded-br-md">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{text}</p>
        </MessageContent>
      </Message>
    );
  }

  return (
    <Message from="assistant" className="max-w-full">
      <div className="flex gap-3">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-sidebar">
          <img src={somaIcon} alt="" className="size-4" />
        </div>
        <MessageContent className="w-full max-w-full flex-1 gap-1">
          {message.parts.map((part, index) => {
            const key = `${message.id}-${index}`;
            if (part.type === "text") {
              if (!part.text) return null;
              return (
                <MessageResponse
                  key={key}
                  isAnimating={isStreaming && index === message.parts.length - 1}
                  className="prose prose-sm max-w-none text-foreground dark:prose-invert [&_[data-streamdown=table-wrapper]]:bg-muted/60 [&_[data-streamdown=table-wrapper]]:p-1.5"
                >
                  {part.text}
                </MessageResponse>
              );
            }
            if (part.type === "reasoning") {
              if (!part.text?.trim()) return null;
              return (
                <Reasoning
                  key={key}
                  isStreaming={isStreaming && part.state === "streaming"}
                  className="mb-1"
                  defaultOpen={false}
                  getThinkingMessage={thinkingMessage}
                >
                  <ReasoningTrigger />
                  <ReasoningContent>{part.text}</ReasoningContent>
                </Reasoning>
              );
            }
            if (isToolUIPart(part)) {
              return <BoardAgentToolPart key={key} part={part} />;
            }
            return null;
          })}
        </MessageContent>
      </div>
    </Message>
  );
}
