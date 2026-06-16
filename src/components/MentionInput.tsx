import { useState, useRef, useEffect, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useBoardMembers } from "@/hooks/useBoardMembers";
import { useDemandsList } from "@/hooks/useDemandsList";
import { formatMentionForStorage, formatDemandMentionForStorage, parseMentionsToArray } from "@/lib/mentionUtils";
import { formatDemandCode } from "@/lib/demandCodeUtils";
import { cn, truncateText } from "@/lib/utils";

// Attach resize handle to an image inside contenteditable
function attachResizeHandle(img: HTMLImageElement, onResize: () => void) {
  // Wrap image in a relative container if not already wrapped
  if (img.parentElement?.classList.contains("mention-img-wrapper")) return;
  
  const wrapper = document.createElement("span");
  wrapper.contentEditable = "false";
  wrapper.className = "mention-img-wrapper";
  wrapper.style.cssText = "position:relative;display:inline-block;vertical-align:bottom;margin:4px 2px;";
  
  img.parentNode?.insertBefore(wrapper, img);
  wrapper.appendChild(img);
  
  const handle = document.createElement("div");
  handle.style.cssText = "position:absolute;bottom:2px;right:2px;width:14px;height:14px;cursor:nwse-resize;background:hsl(var(--primary));border-radius:2px;opacity:0;transition:opacity 0.15s;";
  handle.contentEditable = "false";
  wrapper.appendChild(handle);

  wrapper.addEventListener("mouseenter", () => { handle.style.opacity = "0.7"; });
  wrapper.addEventListener("mouseleave", () => { handle.style.opacity = "0"; });

  let startX = 0;
  let startW = 0;

  const onMouseMove = (e: MouseEvent) => {
    const newW = Math.max(50, Math.min(1200, startW + (e.clientX - startX)));
    img.style.width = newW + "px";
    img.setAttribute("width", String(Math.round(newW)));
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    onResize();
  };

  handle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    startX = e.clientX;
    startW = img.getBoundingClientRect().width;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  boardId: string;
  placeholder?: string;
  className?: string;
  onBlur?: () => void;
  allowedRoles?: ("admin" | "moderator" | "executor" | "requester")[];
  enableDemandMentions?: boolean;
}

interface MentionData {
  userId: string;
  name: string;
}

export function MentionInput({ 
  value, 
  onChange, 
  boardId, 
  placeholder = "Digite aqui...", 
  className, 
  onBlur, 
  allowedRoles,
  enableDemandMentions = true 
}: MentionInputProps) {
  // User mention states
  const [showUserSuggestions, setShowUserSuggestions] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [selectedUserIndex, setSelectedUserIndex] = useState(0);
  
  // Demand mention states
  const [showDemandSuggestions, setShowDemandSuggestions] = useState(false);
  const [demandQuery, setDemandQuery] = useState("");
  const [selectedDemandIndex, setSelectedDemandIndex] = useState(0);
  
  const [isEmpty, setIsEmpty] = useState(!value);
  const [dropdownPosition, setDropdownPosition] = useState<"bottom" | "top">("bottom");
  const editorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { data: members } = useBoardMembers(boardId);
  const { data: demands } = useDemandsList(enableDemandMentions ? boardId : null);

  const filteredMembers = members?.filter((m) => {
    const matchesName = m.profile?.full_name?.toLowerCase().includes(userQuery.toLowerCase());
    const matchesRole = !allowedRoles || (m.role && allowedRoles.includes(m.role));
    return matchesName && matchesRole;
  }) || [];

  const filteredDemands = demands?.filter((d) => {
    const code = formatDemandCode(d.board_sequence_number);
    const matchesCode = code.toLowerCase().includes(demandQuery.toLowerCase());
    const matchesTitle = d.title.toLowerCase().includes(demandQuery.toLowerCase());
    return matchesCode || matchesTitle;
  }) || [];

  // Check if editor is empty
  const checkIsEmpty = useCallback(() => {
    if (!editorRef.current) return true;
    const text = editorRef.current.textContent || "";
    const hasImages = editorRef.current.querySelector("img") !== null;
    return text.trim() === "" && !hasImages;
  }, []);

  // Calculate dropdown position based on available space
  const calculateDropdownPosition = useCallback(() => {
    if (!containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const dropdownHeight = 192;
    const spaceBelow = viewportHeight - containerRect.bottom;
    const spaceAbove = containerRect.top;
    
    if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
      setDropdownPosition("top");
    } else {
      setDropdownPosition("bottom");
    }
  }, []);

  // Recalculate position when suggestions are shown
  useEffect(() => {
    if ((showUserSuggestions && filteredMembers.length > 0) || (showDemandSuggestions && filteredDemands.length > 0)) {
      calculateDropdownPosition();
    }
  }, [showUserSuggestions, showDemandSuggestions, filteredMembers.length, filteredDemands.length, calculateDropdownPosition]);

  // Cria elemento de tag de menção de usuário
  const createUserMentionElement = (userId: string, name: string): HTMLSpanElement => {
    const span = document.createElement("span");
    span.contentEditable = "false";
    span.className = "inline-flex items-center gap-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md px-1.5 py-0.5 text-xs font-medium mx-0.5 select-none align-baseline";
    span.setAttribute("data-mention-user-id", userId);
    span.setAttribute("data-mention-name", name);
    span.textContent = `@${name}`;
    return span;
  };

  // Cria elemento de tag de menção de demanda
  const createDemandMentionElement = (demandId: string, code: string): HTMLSpanElement => {
    const span = document.createElement("span");
    span.contentEditable = "false";
    span.className = "inline-flex items-center gap-0.5 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 rounded-md px-1.5 py-0.5 text-xs font-medium mx-0.5 select-none align-baseline cursor-pointer";
    span.setAttribute("data-mention-demand-id", demandId);
    span.setAttribute("data-mention-demand-code", code);
    span.textContent = code;
    return span;
  };

  // Converte conteúdo do editor para formato de armazenamento
  const getStorageValue = useCallback((): string => {
    if (!editorRef.current) return "";
    
    const extractContent = (parent: Node): string => {
      let result = "";
      const nodes = parent.childNodes;
      
      nodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          result += node.textContent || "";
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          const userId = element.getAttribute("data-mention-user-id");
          const userName = element.getAttribute("data-mention-name");
          const demandId = element.getAttribute("data-mention-demand-id");
          const demandCode = element.getAttribute("data-mention-demand-code");
          
          if (userId && userName) {
            result += formatMentionForStorage(userId, userName);
          } else if (demandId && demandCode) {
            result += formatDemandMentionForStorage(demandId, demandCode);
          } else if (element.tagName === "IMG") {
            // Preserve inline images with width, ensuring newlines around images
            const src = element.getAttribute("src");
            const width = element.getAttribute("width") || element.style.width?.replace("px", "");
            if (src) {
              if (result && !result.endsWith("\n")) result += "\n";
              result += width ? `<img src="${src}" width="${parseInt(width, 10)}" />` : `<img src="${src}" />`;
              result += "\n";
            }
          } else if (element.tagName === "BR") {
            result += "\n";
          } else if (["P", "DIV", "BLOCKQUOTE", "LI"].includes(element.tagName)) {
            const inner = extractContent(element);
            if (result && !result.endsWith("\n") && inner) {
              result += "\n";
            }
            result += inner;
            if (inner && !inner.endsWith("\n")) {
              result += "\n";
            }
          } else {
            result += extractContent(element);
          }
        }
      });
      
      return result;
    };
    
    return extractContent(editorRef.current).replace(/\n+$/, "");
  }, []);

  // Renderiza valor inicial no editor
  const renderValueToEditor = useCallback((storageValue: string) => {
    if (!editorRef.current) return;
    
    // Clear using safe DOM API instead of innerHTML
    while (editorRef.current.firstChild) {
      editorRef.current.removeChild(editorRef.current.firstChild);
    }
    
    if (!storageValue) return;
    
    const parts = parseMentionsToArray(storageValue);
    
    parts.forEach((part) => {
      if (typeof part === "string") {
        // Check for inline images within text parts
        const imgRegex = /<img\s+src="([^"]+)"(?:\s+width="(\d+)")?\s*\/?>/g;
        let lastIndex = 0;
        let match;
        
        while ((match = imgRegex.exec(part)) !== null) {
          // Add text before the image
          const textBefore = part.slice(lastIndex, match.index);
          if (textBefore) {
            const lines = textBefore.split("\n");
            lines.forEach((line, index) => {
              if (line) {
                editorRef.current!.appendChild(document.createTextNode(line));
              }
              if (index < lines.length - 1) {
                editorRef.current!.appendChild(document.createElement("br"));
              }
            });
          }
          // Add the image element
          const img = document.createElement("img");
          img.src = match[1];
          img.className = "max-w-[300px] h-auto rounded-md my-2 inline-block";
          if (match[2]) {
            img.style.width = match[2] + "px";
            img.setAttribute("width", match[2]);
          }
          editorRef.current!.appendChild(img);
          lastIndex = match.index + match[0].length;
        }
        
        // Add remaining text after last image (or all text if no images)
        const remaining = part.slice(lastIndex);
        if (remaining) {
          const lines = remaining.split("\n");
          lines.forEach((line, index) => {
            if (line) {
              editorRef.current!.appendChild(document.createTextNode(line));
            }
            if (index < lines.length - 1) {
              editorRef.current!.appendChild(document.createElement("br"));
            }
          });
        }
      } else if (part.type === "user_mention") {
        const mentionEl = createUserMentionElement(part.userId, part.name);
        editorRef.current!.appendChild(mentionEl);
      } else if (part.type === "demand_mention") {
        const mentionEl = createDemandMentionElement(part.demandId, part.code);
        editorRef.current!.appendChild(mentionEl);
      }
    });
  }, []);

  // Sincroniza valor externo -> editor
  useEffect(() => {
    if (editorRef.current) {
      const currentValue = getStorageValue();
      if (value !== currentValue) {
        renderValueToEditor(value);
        // Attach resize handles to all images after rendering
        setTimeout(() => {
          if (!editorRef.current) return;
          const images = editorRef.current.querySelectorAll("img");
          images.forEach((img) => {
            attachResizeHandle(img as HTMLImageElement, () => onChange(getStorageValue()));
          });
        }, 0);
      }
      setIsEmpty(checkIsEmpty());
    }
  }, [value, getStorageValue, renderValueToEditor, checkIsEmpty, onChange]);

  // Fecha sugestões ao clicar fora
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!editorRef.current?.contains(e.target as Node)) {
        setShowUserSuggestions(false);
        setShowDemandSuggestions(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  // Detecta digitação de @ ou #
  const handleInput = () => {
    setIsEmpty(checkIsEmpty());
    
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    
    if (container.nodeType !== Node.TEXT_NODE) {
      setShowUserSuggestions(false);
      setShowDemandSuggestions(false);
      onChange(getStorageValue());
      return;
    }
    
    const text = container.textContent || "";
    const cursorPos = range.startOffset;
    const textBeforeCursor = text.slice(0, cursorPos);
    
    // Procura @ para menção de usuário
    const atIndex = textBeforeCursor.lastIndexOf("@");
    const hashIndex = textBeforeCursor.lastIndexOf("#");
    
    // Verifica qual está mais próximo do cursor
    if (atIndex !== -1 && (hashIndex === -1 || atIndex > hashIndex)) {
      const textAfterAt = textBeforeCursor.slice(atIndex + 1);
      if (!textAfterAt.includes(" ") && textAfterAt.length <= 30) {
        setUserQuery(textAfterAt);
        setShowUserSuggestions(true);
        setShowDemandSuggestions(false);
        setSelectedUserIndex(0);
        onChange(getStorageValue());
        return;
      }
    }
    
    // Procura # para menção de demanda
    if (enableDemandMentions && hashIndex !== -1 && (atIndex === -1 || hashIndex > atIndex)) {
      const textAfterHash = textBeforeCursor.slice(hashIndex + 1);
      if (!textAfterHash.includes(" ") && textAfterHash.length <= 10) {
        setDemandQuery(textAfterHash);
        setShowDemandSuggestions(true);
        setShowUserSuggestions(false);
        setSelectedDemandIndex(0);
        onChange(getStorageValue());
        return;
      }
    }
    
    setShowUserSuggestions(false);
    setShowDemandSuggestions(false);
    onChange(getStorageValue());
  };

  // Insere menção de usuário
  const insertUserMention = (userId: string, name: string) => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !editorRef.current) return;
    
    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    
    if (container.nodeType !== Node.TEXT_NODE) return;
    
    const text = container.textContent || "";
    const cursorPos = range.startOffset;
    const textBeforeCursor = text.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    
    if (atIndex === -1) return;
    
    const mentionEl = createUserMentionElement(userId, name);
    const beforeAt = text.slice(0, atIndex);
    const afterCursor = text.slice(cursorPos);
    
    const beforeNode = document.createTextNode(beforeAt);
    const afterNode = document.createTextNode(" " + afterCursor);
    
    const parent = container.parentNode;
    if (parent) {
      parent.insertBefore(beforeNode, container);
      parent.insertBefore(mentionEl, container);
      parent.insertBefore(afterNode, container);
      parent.removeChild(container);
      
      const newRange = document.createRange();
      newRange.setStart(afterNode, 1);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
    
    setShowUserSuggestions(false);
    setUserQuery("");
    onChange(getStorageValue());
    editorRef.current.focus();
  };

  // Insere menção de demanda
  const insertDemandMention = (demandId: string, code: string) => {
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount || !editorRef.current) return;
    
    const range = selection.getRangeAt(0);
    const container = range.startContainer;
    
    if (container.nodeType !== Node.TEXT_NODE) return;
    
    const text = container.textContent || "";
    const cursorPos = range.startOffset;
    const textBeforeCursor = text.slice(0, cursorPos);
    const hashIndex = textBeforeCursor.lastIndexOf("#");
    
    if (hashIndex === -1) return;
    
    const mentionEl = createDemandMentionElement(demandId, code);
    const beforeHash = text.slice(0, hashIndex);
    const afterCursor = text.slice(cursorPos);
    
    const beforeNode = document.createTextNode(beforeHash);
    const afterNode = document.createTextNode(" " + afterCursor);
    
    const parent = container.parentNode;
    if (parent) {
      parent.insertBefore(beforeNode, container);
      parent.insertBefore(mentionEl, container);
      parent.insertBefore(afterNode, container);
      parent.removeChild(container);
      
      const newRange = document.createRange();
      newRange.setStart(afterNode, 1);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);
    }
    
    setShowDemandSuggestions(false);
    setDemandQuery("");
    onChange(getStorageValue());
    editorRef.current.focus();
  };

  // Detecta Backspace em tag para deletar atomicamente
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Navegação nas sugestões de usuários
    if (showUserSuggestions && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedUserIndex((prev) => (prev + 1) % filteredMembers.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedUserIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const member = filteredMembers[selectedUserIndex];
        if (member?.user_id && member?.profile?.full_name) {
          insertUserMention(member.user_id, member.profile.full_name);
        }
        return;
      }
      if (e.key === "Escape") {
        setShowUserSuggestions(false);
        return;
      }
    }

    // Navegação nas sugestões de demandas
    if (showDemandSuggestions && filteredDemands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedDemandIndex((prev) => (prev + 1) % filteredDemands.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedDemandIndex((prev) => (prev - 1 + filteredDemands.length) % filteredDemands.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();
        const demand = filteredDemands[selectedDemandIndex];
        if (demand?.id && demand?.board_sequence_number !== undefined) {
          insertDemandMention(demand.id, formatDemandCode(demand.board_sequence_number));
        }
        return;
      }
      if (e.key === "Escape") {
        setShowDemandSuggestions(false);
        return;
      }
    }

    // Deleção atômica de tags
    if (e.key === "Backspace") {
      const selection = window.getSelection();
      if (!selection || !selection.rangeCount) return;
      
      const range = selection.getRangeAt(0);
      
      if (!range.collapsed) return;
      
      const container = range.startContainer;
      const offset = range.startOffset;
      
      if (container.nodeType === Node.TEXT_NODE && offset === 0) {
        const prevSibling = container.previousSibling;
        if (prevSibling && prevSibling.nodeType === Node.ELEMENT_NODE) {
          const element = prevSibling as HTMLElement;
          if (element.hasAttribute("data-mention-user-id") || element.hasAttribute("data-mention-demand-id")) {
            e.preventDefault();
            element.remove();
            onChange(getStorageValue());
            return;
          }
        }
      }
      
      if (container === editorRef.current) {
        const childNodes = Array.from(editorRef.current.childNodes);
        if (offset > 0 && childNodes[offset - 1]) {
          const prevNode = childNodes[offset - 1];
          if (prevNode.nodeType === Node.ELEMENT_NODE) {
            const element = prevNode as HTMLElement;
            if (element.hasAttribute("data-mention-user-id") || element.hasAttribute("data-mention-demand-id")) {
              e.preventDefault();
              element.remove();
              onChange(getStorageValue());
              return;
            }
          }
        }
      }
    }
  };

  // Handle paste: strip formatting but preserve line breaks and plain text
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    
    const clipboardData = e.clipboardData;
    
    // Check for pasted image files (screenshots, copied images)
    const items = clipboardData.items;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const selection = window.getSelection();
            if (!selection || !selection.rangeCount || !editorRef.current) return;
            
            const range = selection.getRangeAt(0);
            range.deleteContents();
            
            const img = document.createElement("img");
            img.src = dataUrl;
            img.className = "max-w-[300px] h-auto rounded-md my-2 inline-block";
            range.insertNode(img);
            
            // Attach resize handle
            attachResizeHandle(img, () => onChange(getStorageValue()));
            
            // Move cursor after wrapper
            const wrapper = img.parentElement;
            if (wrapper) {
              range.setStartAfter(wrapper);
            } else {
              range.setStartAfter(img);
            }
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
            
            onChange(getStorageValue());
            setIsEmpty(checkIsEmpty());
          };
          reader.readAsDataURL(file);
          return;
        }
      }
    }
    
    // Try HTML first to preserve images
    const html = clipboardData.getData("text/html");
    if (html) {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const images = doc.querySelectorAll("img");
      
      if (images.length > 0) {
        // Has images - preserve them along with text
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const fragment = document.createDocumentFragment();
        
        const processNode = (node: Node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent || "";
            const lines = text.split(/\r?\n/);
            lines.forEach((line, idx) => {
              if (line) fragment.appendChild(document.createTextNode(line));
              if (idx < lines.length - 1) fragment.appendChild(document.createElement("br"));
            });
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as HTMLElement;
            if (el.tagName === "IMG") {
              const src = el.getAttribute("src");
              if (src && src.startsWith("http")) {
                const img = document.createElement("img");
                img.src = src;
                img.className = "max-w-[300px] h-auto rounded-md my-2 inline-block";
                fragment.appendChild(img);
              }
            } else if (el.tagName === "BR") {
              fragment.appendChild(document.createElement("br"));
            } else {
              el.childNodes.forEach(processNode);
              if (["P", "DIV"].includes(el.tagName)) {
                fragment.appendChild(document.createElement("br"));
              }
            }
          }
        };
        
        doc.body.childNodes.forEach(processNode);
        range.insertNode(fragment);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Attach resize handles to pasted images
        setTimeout(() => {
          if (!editorRef.current) return;
          editorRef.current.querySelectorAll("img").forEach((img) => {
            attachResizeHandle(img as HTMLImageElement, () => onChange(getStorageValue()));
          });
        }, 0);
        
        onChange(getStorageValue());
        setIsEmpty(checkIsEmpty());
        return;
      }
    }
    
    // Fallback: plain text
    let text = clipboardData.getData("text/plain");
    if (!text && html) {
      const doc = new DOMParser().parseFromString(html, "text/html");
      text = doc.body.textContent || "";
    }
    
    if (!text) return;
    
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    range.deleteContents();
    
    const lines = text.split(/\r?\n/);
    const fragment = document.createDocumentFragment();
    
    lines.forEach((line, index) => {
      if (line) {
        fragment.appendChild(document.createTextNode(line));
      }
      if (index < lines.length - 1) {
        fragment.appendChild(document.createElement("br"));
      }
    });
    
    range.insertNode(fragment);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    
    onChange(getStorageValue());
    setIsEmpty(checkIsEmpty());
  }, [onChange, getStorageValue, checkIsEmpty]);

  // Previne Enter de criar divs
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !showUserSuggestions && !showDemandSuggestions) {
      e.preventDefault();
      document.execCommand("insertLineBreak");
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onKeyPress={handleKeyPress}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          const files = Array.from(e.dataTransfer.files);
          const imageFiles = files.filter(f => f.type.startsWith('image/'));
          if (imageFiles.length === 0) return;
          e.preventDefault();
          e.stopPropagation();
          for (const file of imageFiles) {
            const reader = new FileReader();
            reader.onload = () => {
              const dataUrl = reader.result as string;
              const selection = window.getSelection();
              if (!selection || !editorRef.current) return;
              const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : document.createRange();
              if (!editorRef.current.contains(range.startContainer)) {
                range.selectNodeContents(editorRef.current);
                range.collapse(false);
              }
              range.deleteContents();
              const img = document.createElement("img");
              img.src = dataUrl;
              img.className = "max-w-[300px] h-auto rounded-md my-2 inline-block";
              range.insertNode(img);
              attachResizeHandle(img, () => onChange(getStorageValue()));
              const wrapper = img.parentElement;
              if (wrapper) { range.setStartAfter(wrapper); } else { range.setStartAfter(img); }
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
              onChange(getStorageValue());
              setIsEmpty(checkIsEmpty());
            };
            reader.readAsDataURL(file);
          }
        }}
        onBlur={() => {
          setIsEmpty(checkIsEmpty());
          setTimeout(() => {
            onBlur?.();
          }, 150);
        }}
        onFocus={() => setIsEmpty(checkIsEmpty())}
        className={cn(
          "min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-none",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:[box-shadow:var(--focus-ring)] transition-[border-color,box-shadow] duration-200",
          "overflow-auto",
          className
        )}
      />
      
      {/* Placeholder overlay */}
      {isEmpty && (
        <div 
          className="absolute top-2 left-3 text-sm text-muted-foreground pointer-events-none"
          aria-hidden="true"
        >
          {placeholder}
        </div>
      )}
      
      {/* User suggestions dropdown */}
      {showUserSuggestions && filteredMembers.length > 0 && (
        <div 
          ref={dropdownRef}
          className={cn(
            "absolute z-50 w-full bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto",
            dropdownPosition === "bottom" ? "top-full mt-1" : "bottom-full mb-1"
          )}
        >
          {filteredMembers.map((member, index) => (
            <button
              key={member.user_id}
              type="button"
              className={cn(
                "w-full flex items-center gap-2 p-2 text-left transition-colors",
                index === selectedUserIndex ? "bg-accent" : "hover:bg-muted"
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (member.user_id && member.profile?.full_name) {
                  insertUserMention(member.user_id, member.profile.full_name);
                }
              }}
              onMouseEnter={() => setSelectedUserIndex(index)}
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={member.profile?.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {member.profile?.full_name?.charAt(0) || "?"}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm">{member.profile?.full_name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Demand suggestions dropdown */}
      {showDemandSuggestions && filteredDemands.length > 0 && (
        <div 
          ref={dropdownRef}
          className={cn(
            "absolute z-50 w-full bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto",
            dropdownPosition === "bottom" ? "top-full mt-1" : "bottom-full mb-1"
          )}
        >
          {filteredDemands.map((demand, index) => (
            <button
              key={demand.id}
              type="button"
              className={cn(
                "w-full flex items-center gap-2 p-2 text-left transition-colors",
                index === selectedDemandIndex ? "bg-accent" : "hover:bg-muted"
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                insertDemandMention(demand.id, formatDemandCode(demand.board_sequence_number));
              }}
              onMouseEnter={() => setSelectedDemandIndex(index)}
            >
              <Badge variant="outline" className="bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20 font-mono">
                {formatDemandCode(demand.board_sequence_number)}
              </Badge>
              <span className="text-sm truncate flex-1" title={demand.title}>{truncateText(demand.title)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
