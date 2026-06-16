import React from "react";

// Formato de armazenamento para usuários: [[user_id:Nome Completo]]
const USER_MENTION_REGEX = /\[\[([^:]+):([^\]]+)\]\]/g;

// Formato de armazenamento para demandas: {{demand_id:#0001}}
const DEMAND_MENTION_REGEX = /\{\{([^:]+):(#[^\}]+)\}\}/g;

// Regex para detectar URLs
const URL_REGEX = /(https?:\/\/[^\s<>]+)/g;

// Converte texto com marcadores para array de strings e objetos de menção
export interface ParsedUserMention {
  type: "user_mention";
  userId: string;
  name: string;
}

export interface ParsedDemandMention {
  type: "demand_mention";
  demandId: string;
  code: string;
}

export interface ParsedLink {
  type: "link";
  url: string;
  displayText: string;
}

export interface ParsedImage {
  type: "inline_image";
  src: string;
  width?: number;
}

export type ParsedContent = string | ParsedUserMention | ParsedDemandMention | ParsedLink | ParsedImage;

export function parseMentionsToArray(text: string): ParsedContent[] {
  const parts: ParsedContent[] = [];
  
  // Combined regex to match mentions, demands, and URLs
  const COMBINED_REGEX = /(\[\[([^:]+):([^\]]+)\]\])|(\{\{([^:]+):(#[^\}]+)\}\})|(<img\s+src="([^"]+)"(?:\s+width="(\d+)")?\s*\/?>)|(https?:\/\/[^\s<>\[\]\{\}]+)/g;
  
  let lastIndex = 0;
  COMBINED_REGEX.lastIndex = 0;
  
  let match;
  while ((match = COMBINED_REGEX.exec(text)) !== null) {
    // Adiciona texto antes da menção
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    if (match[1]) {
      // User mention: [[user_id:Nome]]
      const userId = match[2];
      const name = match[3];
      parts.push({ type: "user_mention", userId, name });
    } else if (match[4]) {
      // Demand mention: {{demand_id:#0001}}
      const demandId = match[5];
      const code = match[6];
      parts.push({ type: "demand_mention", demandId, code });
    } else if (match[7]) {
      // Inline image: <img src="..." width="..." />
      const src = match[8];
      const width = match[9] ? parseInt(match[9], 10) : undefined;
      parts.push({ type: "inline_image", src, width });
    } else if (match[10]) {
      // URL link
      const url = match[10];
      parts.push({ type: "link", url, displayText: url });
    }
    
    lastIndex = match.index + match[0].length;
  }

  // Adiciona texto restante
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

// Função para parsear apenas links (sem menções)
export function parseLinks(text: string): (string | ParsedLink)[] {
  const parts: (string | ParsedLink)[] = [];
  
  let lastIndex = 0;
  URL_REGEX.lastIndex = 0;
  
  let match;
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    const url = match[1];
    parts.push({ type: "link", url, displayText: url });
    
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

// Converte menção de usuário para formato de armazenamento
export function formatMentionForStorage(userId: string, name: string): string {
  return `[[${userId}:${name}]]`;
}

// Converte menção de demanda para formato de armazenamento
export function formatDemandMentionForStorage(demandId: string, code: string): string {
  return `{{${demandId}:${code}}}`;
}

// Extrai IDs de usuários mencionados
export function extractMentionedUserIds(text: string): string[] {
  const ids: string[] = [];
  USER_MENTION_REGEX.lastIndex = 0;
  
  let match;
  while ((match = USER_MENTION_REGEX.exec(text)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

// Extrai IDs de demandas mencionadas
export function extractMentionedDemandIds(text: string): string[] {
  const ids: string[] = [];
  DEMAND_MENTION_REGEX.lastIndex = 0;
  
  let match;
  while ((match = DEMAND_MENTION_REGEX.exec(text)) !== null) {
    ids.push(match[1]);
  }
  return ids;
}

// Verifica se texto contém menções de usuários
export function hasMentions(text: string): boolean {
  USER_MENTION_REGEX.lastIndex = 0;
  return USER_MENTION_REGEX.test(text);
}

// Verifica se texto contém menções de demandas
export function hasDemandMentions(text: string): boolean {
  DEMAND_MENTION_REGEX.lastIndex = 0;
  return DEMAND_MENTION_REGEX.test(text);
}

// Verifica se texto contém links
export function hasLinks(text: string): boolean {
  URL_REGEX.lastIndex = 0;
  return URL_REGEX.test(text);
}

// Extrai IDs de usuários mencionados em conteúdo HTML (usado em notas com TipTap)
// Formato: <a href="/user/UUID" data-mention="user">@Nome</a>
const HTML_USER_MENTION_REGEX = /href="\/user\/([a-f0-9-]+)"\s+data-mention="user"/g;

export function extractMentionedUserIdsFromHtml(html: string): string[] {
  const ids: string[] = [];
  HTML_USER_MENTION_REGEX.lastIndex = 0;
  let match;
  while ((match = HTML_USER_MENTION_REGEX.exec(html)) !== null) {
    if (!ids.includes(match[1])) {
      ids.push(match[1]);
    }
  }
  return ids;
}

// Extrai IDs de usuários mencionados de qualquer formato (plaintext [[id:name]] ou HTML data-mention)
export function extractAllMentionedUserIds(content: string): string[] {
  const fromPlaintext = extractMentionedUserIds(content);
  const fromHtml = extractMentionedUserIdsFromHtml(content);
  const combined = new Set([...fromPlaintext, ...fromHtml]);
  return Array.from(combined);
}
