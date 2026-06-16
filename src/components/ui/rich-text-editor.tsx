import { useEditor, EditorContent, Editor, NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Highlighter,
  ImageIcon,
  Loader2,
  X,
} from "lucide-react";
import { Toggle } from "@/components/ui/toggle";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  minHeight?: string;
}

const HIGHLIGHT_COLORS = [
  { name: "Amarelo", color: "#fef08a" },
  { name: "Verde", color: "#bbf7d0" },
  { name: "Azul", color: "#bfdbfe" },
  { name: "Rosa", color: "#fbcfe8" },
  { name: "Laranja", color: "#fed7aa" },
];

// Sanitize HTML to prevent XSS
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "em", "u", "s", "span", "img", 
      "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "mark", "a"
    ],
    ALLOWED_ATTR: ["style", "src", "alt", "class", "data-color", "href", "target", "rel", "data-mention", "width", "height"],
    ADD_ATTR: ["style", "data-color", "data-mention"],
  });
}

// Extract plain text from HTML for preview purposes
export function extractPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

interface EditorToolbarProps {
  editor: Editor | null;
  onImageUpload: () => void;
  isUploading: boolean;
}

function EditorToolbar({ editor, onImageUpload, isUploading }: EditorToolbarProps) {
  if (!editor) return null;

  const handleAlignment = (alignment: "left" | "center" | "right" | "justify") => {
    const { from, to } = editor.state.selection;
    const hasSelection = from !== to;

    if (hasSelection) {
      editor.chain().focus().setTextAlign(alignment).run();
    } else {
      const currentPos = from;
      editor
        .chain()
        .focus()
        .selectAll()
        .setTextAlign(alignment)
        .setTextSelection(currentPos)
        .run();
    }
  };

  return (
    <div className="flex-shrink-0 flex flex-wrap items-center gap-0.5 p-1 border-b border-border bg-muted/30">
      {/* Text formatting */}
      <Toggle
        size="sm"
        pressed={editor.isActive("bold")}
        onPressedChange={() => editor.chain().focus().toggleBold().run()}
        aria-label="Negrito"
        title="Negrito (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("italic")}
        onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Itálico"
        title="Itálico (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("underline")}
        onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
        aria-label="Sublinhado"
        title="Sublinhado (Ctrl+U)"
      >
        <UnderlineIcon className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive("strike")}
        onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        aria-label="Riscado"
        title="Riscado"
      >
        <Strikethrough className="h-4 w-4" />
      </Toggle>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Text alignment */}
      <Toggle
        size="sm"
        pressed={editor.isActive({ textAlign: "left" })}
        onPressedChange={() => handleAlignment("left")}
        aria-label="Alinhar à esquerda"
        title="Alinhar à esquerda"
      >
        <AlignLeft className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive({ textAlign: "center" })}
        onPressedChange={() => handleAlignment("center")}
        aria-label="Centralizar"
        title="Centralizar"
      >
        <AlignCenter className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive({ textAlign: "right" })}
        onPressedChange={() => handleAlignment("right")}
        aria-label="Alinhar à direita"
        title="Alinhar à direita"
      >
        <AlignRight className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive({ textAlign: "justify" })}
        onPressedChange={() => handleAlignment("justify")}
        aria-label="Justificar"
        title="Justificar"
      >
        <AlignJustify className="h-4 w-4" />
      </Toggle>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Highlight colors */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              "h-8 w-8 p-0",
              editor.isActive("highlight") && "bg-accent"
            )}
            title="Marca-texto"
          >
            <Highlighter className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground mb-1">Cor do destaque</p>
            <div className="flex gap-1">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.color}
                  type="button"
                  className={cn(
                    "w-6 h-6 rounded border border-border hover:scale-110 transition-transform",
                    editor.isActive("highlight", { color: c.color }) && "ring-2 ring-primary"
                  )}
                  style={{ backgroundColor: c.color }}
                  onClick={() => editor.chain().focus().toggleHighlight({ color: c.color }).run()}
                  title={c.name}
                />
              ))}
              <button
                type="button"
                className="w-6 h-6 rounded border border-border hover:scale-110 transition-transform flex items-center justify-center text-xs"
                onClick={() => editor.chain().focus().unsetHighlight().run()}
                title="Remover destaque"
              >
                ✕
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <div className="w-px h-6 bg-border mx-1" />

      {/* Image upload */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={onImageUpload}
        disabled={isUploading}
        title="Inserir imagem"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ImageIcon className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

// Custom resizable Image extension
const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute("width") || element.style.width || null,
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width, style: `width: ${attributes.width}px` };
        },
      },
    };
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const container = document.createElement("div");
      container.classList.add("resizable-image-wrapper");
      container.style.display = "inline-block";
      container.style.position = "relative";
      container.style.maxWidth = "100%";
      container.style.lineHeight = "0";

      const img = document.createElement("img");
      img.src = node.attrs.src;
      img.alt = node.attrs.alt || "";
      img.classList.add("rounded-md", "my-2", "cursor-pointer");
      img.style.maxWidth = "100%";
      img.style.height = "auto";
      img.style.display = "block";

      if (node.attrs.width) {
        img.style.width = `${node.attrs.width}px`;
      } else {
        img.style.width = "300px";
      }

      // Resize handle
      const handle = document.createElement("div");
      handle.style.cssText = "position:absolute;bottom:2px;right:2px;width:14px;height:14px;background:hsl(var(--primary));border-radius:2px;cursor:nwse-resize;opacity:0;transition:opacity 0.15s;display:flex;align-items:center;justify-content:center;";
      handle.innerHTML = `<svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M7 1L1 7M7 4L4 7M7 7L7 7" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>`;

      container.addEventListener("mouseenter", () => { handle.style.opacity = "1"; });
      container.addEventListener("mouseleave", () => { handle.style.opacity = "0"; });

      let startX = 0;
      let startWidth = 0;

      const onMouseMove = (e: MouseEvent) => {
        const newWidth = Math.max(50, Math.min(1200, startWidth + (e.clientX - startX)));
        img.style.width = `${newWidth}px`;
      };

      const onMouseUp = (e: MouseEvent) => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        const finalWidth = Math.max(50, Math.min(1200, startWidth + (e.clientX - startX)));
        if (typeof getPos === "function") {
          editor.chain().focus().command(({ tr }) => {
            tr.setNodeMarkup(getPos(), undefined, {
              ...node.attrs,
              width: finalWidth,
            });
            return true;
          }).run();
        }
      };

      handle.addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        startX = e.clientX;
        startWidth = img.offsetWidth;
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      });

      container.appendChild(img);
      container.appendChild(handle);

      return {
        dom: container,
        contentDOM: null,
        update: (updatedNode: any) => {
          if (updatedNode.type.name !== "image") return false;
          img.src = updatedNode.attrs.src;
          if (updatedNode.attrs.width) {
            img.style.width = `${updatedNode.attrs.width}px`;
          }
          return true;
        },
      };
    };
  },
});

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Digite aqui...",
  disabled = false,
  className,
  minHeight = "120px",
}: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isUploadingRef = useRef(false);
  const uploadCountRef = useRef<{ count: number; resetTime: number }>({ count: 0, resetTime: Date.now() });

  const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/svg+xml',
  ];

  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Tipo de arquivo não permitido. Use JPEG, PNG, GIF, WebP ou SVG.");
      return null;
    }

    const allowedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !allowedExtensions.includes(ext)) {
      toast.error("Extensão de arquivo inválida");
      return null;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return null;
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    if (uploadCountRef.current.resetTime < oneMinuteAgo) {
      uploadCountRef.current = { count: 0, resetTime: now };
    }
    
    if (uploadCountRef.current.count >= 10) {
      toast.error("Limite de uploads atingido. Aguarde 1 minuto.");
      return null;
    }
    
    uploadCountRef.current.count++;
    isUploadingRef.current = true;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || "anonymous";
      
      const fileExt = file.name.split(".").pop() || "png";
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("inline-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("inline-images")
        .getPublicUrl(filePath);

      toast.success("Imagem inserida!");
      return urlData.publicUrl;
    } catch (error) {
      console.error("Erro ao fazer upload da imagem:", error);
      toast.error("Erro ao fazer upload da imagem");
      return null;
    } finally {
      isUploadingRef.current = false;
    }
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ["paragraph"],
      }),
      Highlight.configure({
        multicolor: true,
        HTMLAttributes: {
          class: 'highlight-mark',
        },
      }),
      Underline,
      ResizableImage.configure({
        inline: true,
        allowBase64: false,
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(sanitizeHtml(html));
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none p-3",
          "[&_p]:mt-0 [&_p]:mb-2 [&_p]:leading-[1.15] [&_p:last-child]:mb-0",
          "min-h-[var(--min-height)]"
        ),
        style: `--min-height: ${minHeight}`,
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of items) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
              uploadImage(file).then((url) => {
                if (url && editor) {
                  editor.chain().focus().setImage({ src: url }).run();
                }
              });
              return true;
            }
          }
        }
        return false;
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;

        for (const file of files) {
          if (file.type.startsWith("image/")) {
            event.preventDefault();
            uploadImage(file).then((url) => {
              if (url && editor) {
                editor.chain().focus().setImage({ src: url }).run();
              }
            });
            return true;
          }
        }
        return false;
      },
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = await uploadImage(file);
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [uploadImage, editor]);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className={cn(
      "border border-input rounded-md bg-background overflow-hidden transition-colors flex flex-col",
      "focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
      disabled && "opacity-50 cursor-not-allowed",
      className
    )}>
      <EditorToolbar 
        editor={editor} 
        onImageUpload={triggerFileInput}
        isUploading={isUploadingRef.current}
      />
      <div className="flex-1 min-h-0 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

// Escape HTML special characters to prevent XSS
function escapeHtml(text: string): string {
  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEscapes[char] || char);
}

// Validate UUID format to prevent injection
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Validate demand code format
function isValidDemandCode(code: string): boolean {
  return /^#\d{1,6}$/.test(code);
}

// Convert user mentions [[userId:Name]] to styled links with proper escaping
function processMentions(text: string): string {
  const userMentionRegex = /\[\[([^:]+):([^\]]+)\]\]/g;
  text = text.replace(userMentionRegex, (match, userId, name) => {
    if (!isValidUUID(userId)) {
      return escapeHtml(match);
    }
    const escapedName = escapeHtml(name);
    return `<a href="/user/${userId}" data-mention="user" class="inline-flex items-center gap-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md px-1.5 py-0.5 text-xs font-medium mx-0.5 no-underline hover:bg-primary/20 transition-colors">@${escapedName}</a>`;
  });
  
  const demandMentionRegex = /\{\{([^:]+):(#[^\}]+)\}\}/g;
  text = text.replace(demandMentionRegex, (match, demandId, code) => {
    if (!isValidUUID(demandId) || !isValidDemandCode(code)) {
      return escapeHtml(match);
    }
    const escapedCode = escapeHtml(code);
    return `<a href="/demands/${demandId}" data-mention="demand" class="inline-flex items-center gap-0.5 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 rounded-md px-1.5 py-0.5 text-xs font-medium mx-0.5 no-underline hover:bg-cyan-500/20 transition-colors">${escapedCode}</a>`;
  });
  
  return text;
}

// Validate URL format
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Convert plain URLs in text to clickable links
function linkifyText(text: string): string {
  const urlRegex = /(https?:\/\/[^\s<>]+)/g;
  return text.replace(urlRegex, (url) => {
    if (!isValidUrl(url)) {
      return escapeHtml(url);
    }
    const escapedUrl = escapeHtml(url);
    return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline break-all">${escapedUrl}</a>`;
  });
}

// Process text with mentions and links
function processTextContent(text: string): string {
  let result = escapeHtml(text);
  
  const userMentionRegex = /\[\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([^\]]+)\]\]/gi;
  result = result.replace(userMentionRegex, (_, userId, name) => {
    return `<a href="/user/${userId}" data-mention="user" class="inline-flex items-center gap-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md px-1.5 py-0.5 text-xs font-medium mx-0.5 no-underline hover:bg-primary/20 transition-colors">@${name}</a>`;
  });
  
  const demandMentionRegex = /\{\{([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(#\d{1,6})\}\}/gi;
  result = result.replace(demandMentionRegex, (_, demandId, code) => {
    return `<a href="/demands/${demandId}" data-mention="demand" class="inline-flex items-center gap-0.5 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 rounded-md px-1.5 py-0.5 text-xs font-medium mx-0.5 no-underline hover:bg-cyan-500/20 transition-colors">${code}</a>`;
  });
  
  const urlRegex = /(https?:\/\/[^\s]+?)(?=&lt;|&gt;|\s|$)/g;
  result = result.replace(urlRegex, (url) => {
    const displayUrl = url.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline break-all">${displayUrl}</a>`;
  });
  
  return result;
}

// Process HTML content to make URLs and mentions clickable
function processContentWithLinks(html: string): string {
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    return `<p class="whitespace-pre-wrap">${processTextContent(html)}</p>`;
  }
  
  // When content has HTML tags (e.g. <img>) mixed with \n line breaks,
  // convert \n to <br> so line breaks survive DOM parsing
  let normalizedHtml = html;
  if (/\n/.test(html)) {
    normalizedHtml = html.replace(/\n/g, '<br>');
  }
  
  const doc = new DOMParser().parseFromString(normalizedHtml, "text/html");
  
  const processTextNodes = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      const text = node.textContent;
      if (/\[\[([^:]+):([^\]]+)\]\]|\{\{([^:]+):(#[^\}]+)\}\}|(https?:\/\/[^\s<>]+)/.test(text)) {
        const span = document.createElement("span");
        span.innerHTML = processTextContent(text);
        node.parentNode?.replaceChild(span, node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if ((node as Element).tagName !== "A" && !(node as Element).hasAttribute("data-mention")) {
        Array.from(node.childNodes).forEach(processTextNodes);
      }
    }
  };
  
  processTextNodes(doc.body);
  return doc.body.innerHTML;
}

function preserveEmptyParagraphs(html: string): string {
  return html.replace(/<p([^>]*)>(?:\s|&nbsp;|<br\s*\/?\s*>)*<\/p>/gi, "<p$1><br /></p>");
}

// Component for displaying rich text content (read-only) with image lightbox
interface RichTextDisplayProps {
  content: string | null | undefined;
  className?: string;
}

export function RichTextDisplay({ content, className }: RichTextDisplayProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  if (!content) return null;

  const processedContent = preserveEmptyParagraphs(processContentWithLinks(content));

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    
    // Handle image clicks - open lightbox
    if (target.tagName === 'IMG') {
      e.preventDefault();
      e.stopPropagation();
      const src = target.getAttribute('src');
      if (src) {
        setLightboxSrc(src);
      }
      return;
    }

    if (target.tagName === 'A') {
      e.preventDefault();
      e.stopPropagation();
      const href = target.getAttribute('href');
      const isMention = target.hasAttribute('data-mention');
      
      if (href) {
        if (isMention) {
          window.location.href = href;
        } else {
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }
    }
  };

  return (
    <>
      <div 
        className={cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "[&_a]:text-primary [&_a]:hover:underline [&_a]:break-all [&_a]:cursor-pointer",
          "[&_a[data-mention]]:no-underline [&_a[data-mention]]:text-inherit",
          "[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-md [&_img]:my-2 [&_img]:inline-block",
          "[&_img]:cursor-pointer [&_img]:hover:ring-2 [&_img]:hover:ring-primary/30 [&_img]:transition-shadow",
          "[&_p]:mt-0 [&_p]:mb-2 [&_p]:leading-[1.15] [&_p:last-child]:mb-0 [&_p>br:only-child]:block [&_p>br:only-child]:leading-[1.15] [&_p>br:only-child]:min-h-[1.15em]",
          className
        )}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(processedContent) }}
        onClick={handleClick}
      />
      
      {/* Image Lightbox */}
      <Dialog open={!!lightboxSrc} onOpenChange={(open) => !open && setLightboxSrc(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-2 bg-background/95 backdrop-blur-sm border-border">
          <DialogTitle className="sr-only">Visualizar imagem</DialogTitle>
          <div className="flex items-center justify-center w-full h-full overflow-auto">
            {lightboxSrc && (
              <img
                src={lightboxSrc}
                alt="Imagem ampliada"
                className="max-w-full max-h-[85vh] object-contain rounded-md"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
