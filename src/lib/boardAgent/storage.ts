import type { UIMessage } from "ai";

// Uma conversa por quadro, guardada no navegador (decisão provisória: sem histórico em nuvem).
const KEY_PREFIX = "soma:board-agent:v1:";
const MAX_STORED_MESSAGES = 80;

export function boardAgentStorageKey(boardId: string) {
  return `${KEY_PREFIX}${boardId}`;
}

export function loadBoardAgentMessages(boardId: string): UIMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(boardAgentStorageKey(boardId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is UIMessage =>
        !!m &&
        typeof m === "object" &&
        typeof (m as UIMessage).id === "string" &&
        typeof (m as UIMessage).role === "string" &&
        Array.isArray((m as UIMessage).parts),
    );
  } catch {
    return [];
  }
}

export function saveBoardAgentMessages(boardId: string, messages: UIMessage[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = messages.slice(-MAX_STORED_MESSAGES);
    if (trimmed.length === 0) {
      window.localStorage.removeItem(boardAgentStorageKey(boardId));
      return;
    }
    window.localStorage.setItem(boardAgentStorageKey(boardId), JSON.stringify(trimmed));
  } catch {
    // Cota do navegador cheia ou modo privado: a conversa continua só em memória.
  }
}

export function clearBoardAgentMessages(boardId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(boardAgentStorageKey(boardId));
  } catch {
    // ignore
  }
}
