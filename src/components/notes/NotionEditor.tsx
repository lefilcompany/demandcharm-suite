import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import Link from "@tiptap/extension-link";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { common, createLowlight } from "lowlight";
import { useEffect, useCallback, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Highlighter,
  Plus,
  Type,
  CheckSquare,
  Minus,
  Video,
  FileText,
  AtSign,
  Hash,
  Table as TableIcon,
  Link as LinkIcon,
  AlertCircle,
  Info,
  Lightbulb,
  AlertTriangle,
  FileCode,
  ToggleRight,
  Columns,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useDemandsList } from "@/hooks/useDemandsList";
import { useNotes } from "@/hooks/useNotes";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface NotionEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
}

const lowlight = createLowlight(common);

const HIGHLIGHT_COLORS = [
  { name: "Amarelo", color: "#fef08a" },
  { name: "Verde", color: "#bbf7d0" },
  { name: "Azul", color: "#bfdbfe" },
  { name: "Rosa", color: "#fbcfe8" },
  { name: "Roxo", color: "#ddd6fe" },
  { name: "Laranja", color: "#fed7aa" },
];

const CALLOUT_TYPES = [
  { type: "info", icon: Info, label: "Informação", bgClass: "bg-blue-500/10", borderClass: "border-blue-500/30", iconClass: "text-blue-500" },
  { type: "warning", icon: AlertTriangle, label: "Aviso", bgClass: "bg-yellow-500/10", borderClass: "border-yellow-500/30", iconClass: "text-yellow-500" },
  { type: "error", icon: AlertCircle, label: "Alerta", bgClass: "bg-red-500/10", borderClass: "border-red-500/30", iconClass: "text-red-500" },
  { type: "tip", icon: Lightbulb, label: "Dica", bgClass: "bg-green-500/10", borderClass: "border-green-500/30", iconClass: "text-green-500" },
];

type MenuMode = "commands" | "users" | "demands" | "notes";

interface SlashCommand {
  icon: React.ElementType;
  label: string;
  description?: string;
  action: () => void;
  category: string;
}

export function NotionEditor({ content, onChange, placeholder = "Pressione '/' para comandos...", editable = true }: NotionEditorProps) {
  const { currentTeam } = useSelectedTeam();
  const { currentBoard } = useSelectedBoard();
  const { data: teamMembers = [] } = useTeamMembers(currentTeam?.id || null);
  const { data: demandsList = [] } = useDemandsList(currentBoard?.id || null);
  const { data: notesList = [] } = useNotes();
  
  const [isUploading, setIsUploading] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashMenuPosition, setSlashMenuPosition] = useState({ top: 0, left: 0 });
  const [slashFilter, setSlashFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [menuMode, setMenuMode] = useState<MenuMode>("commands");
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Use refs to avoid stale closures in handleKeyDown
  const showSlashMenuRef = useRef(showSlashMenu);
  const slashFilterRef = useRef(slashFilter);
  const selectedIndexRef = useRef(selectedIndex);
  const menuModeRef = useRef(menuMode);
  
  useEffect(() => { showSlashMenuRef.current = showSlashMenu; }, [showSlashMenu]);
  useEffect(() => { slashFilterRef.current = slashFilter; }, [slashFilter]);
  useEffect(() => { selectedIndexRef.current = selectedIndex; }, [selectedIndex]);
  useEffect(() => { menuModeRef.current = menuMode; }, [menuMode]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
        codeBlock: false, // We use CodeBlockLowlight instead
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: "is-editor-empty",
      }),
      Image.configure({
        HTMLAttributes: {
          class: "rounded-lg max-w-full h-auto my-4",
        },
      }),
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TaskList.configure({
        HTMLAttributes: {
          class: "task-list",
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "task-item",
        },
      }),
      Table.configure({
        resizable: true,
        HTMLAttributes: {
          class: "notion-table",
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2 hover:text-primary/80",
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: {
          class: "code-block",
        },
      }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-4 py-2",
      },
      handleKeyDown: (view, event) => {
        const isMenuOpen = showSlashMenuRef.current;
        
        // Keyboard shortcuts
        if (event.ctrlKey || event.metaKey) {
          switch (event.key) {
            case 'b': return false; // Bold - handled by TipTap
            case 'i': return false; // Italic - handled by TipTap
            case 'u': return false; // Underline - handled by TipTap
            case 'k': // Link
              event.preventDefault();
              setShowLinkInput(true);
              return true;
          }
        }
        
        // Handle [[ for note links
        if (event.key === "[" && !isMenuOpen) {
          const { from } = view.state.selection;
          const text = view.state.doc.textBetween(Math.max(0, from - 1), from, "");
          if (text === "[") {
            const coords = view.coordsAtPos(from);
            setSlashMenuPosition({
              top: coords.bottom + 8,
              left: coords.left - 10,
            });
            setShowSlashMenu(true);
            setMenuMode("notes");
            setSlashFilter("");
            setSelectedIndex(0);
            return false;
          }
        }
        
        // Handle @ for user mentions
        if (event.key === "@" && !isMenuOpen) {
          const { from } = view.state.selection;
          const coords = view.coordsAtPos(from);
          setSlashMenuPosition({
            top: coords.bottom + 8,
            left: coords.left,
          });
          setShowSlashMenu(true);
          setMenuMode("users");
          setSlashFilter("");
          setSelectedIndex(0);
          return false;
        }
        
        // Handle # for demand mentions
        if (event.key === "#" && !isMenuOpen) {
          const { from } = view.state.selection;
          const coords = view.coordsAtPos(from);
          setSlashMenuPosition({
            top: coords.bottom + 8,
            left: coords.left,
          });
          setShowSlashMenu(true);
          setMenuMode("demands");
          setSlashFilter("");
          setSelectedIndex(0);
          return false;
        }
        
        // Handle / for commands
        if (event.key === "/" && !isMenuOpen) {
          const { from } = view.state.selection;
          const coords = view.coordsAtPos(from);
          setSlashMenuPosition({
            top: coords.bottom + 8,
            left: coords.left,
          });
          setShowSlashMenu(true);
          setMenuMode("commands");
          setSlashFilter("");
          setSelectedIndex(0);
          return false;
        }
        
        if (isMenuOpen) {
          if (event.key === "Escape") {
            setShowSlashMenu(false);
            return true;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex(prev => prev + 1);
            return true;
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex(prev => Math.max(0, prev - 1));
            return true;
          }
          if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            window.dispatchEvent(new CustomEvent('notion-editor-select'));
            return true;
          }
          if (event.key === "Backspace" && slashFilterRef.current === "") {
            setShowSlashMenu(false);
            return false;
          }
        }
        return false;
      },
    },
  });

  // Handle text input for filtering
  useEffect(() => {
    if (!showSlashMenu || !editor) return;

    const handleInput = () => {
      const { from } = editor.state.selection;
      const text = editor.state.doc.textBetween(Math.max(0, from - 50), from, "");
      
      let trigger = "";
      if (menuMode === "commands") trigger = "/";
      else if (menuMode === "users") trigger = "@";
      else if (menuMode === "demands") trigger = "#";
      else if (menuMode === "notes") trigger = "[[";
      
      const lastTriggerIndex = text.lastIndexOf(trigger);
      if (lastTriggerIndex !== -1) {
        const filter = text.slice(lastTriggerIndex + trigger.length);
        setSlashFilter(filter);
        setSelectedIndex(0);
      }
    };

    editor.on("update", handleInput);
    return () => {
      editor.off("update", handleInput);
    };
  }, [showSlashMenu, editor, menuMode]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const uploadImage = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Apenas imagens são permitidas");
      return null;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `notes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("inline-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("inline-images")
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao fazer upload da imagem");
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  const handleImageUpload = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    const url = await uploadImage(file);
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
    e.target.value = "";
  }, [editor, uploadImage]);

  const handleVideoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Apenas vídeos são permitidos");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `notes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("inline-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("inline-images")
        .getPublicUrl(filePath);

      editor.chain().focus().insertContent(`
        <div class="my-4">
          <video controls class="rounded-lg max-w-full" src="${publicUrl}">
            Seu navegador não suporta vídeos.
          </video>
        </div>
      `).run();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao fazer upload do vídeo");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }, [editor]);

  const handleDocUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `notes/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("inline-images")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("inline-images")
        .getPublicUrl(filePath);

      editor.chain().focus().insertContent(`
        <a href="${publicUrl}" target="_blank" class="inline-flex items-center gap-2 px-3 py-2 bg-muted rounded-lg hover:bg-muted/80 transition-colors my-2">
          📎 ${file.name}
        </a>
      `).run();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erro ao fazer upload do documento");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }, [editor]);

  const insertUserMention = useCallback((userId: string, userName: string) => {
    if (!editor) return;
    
    const { from } = editor.state.selection;
    const text = editor.state.doc.textBetween(Math.max(0, from - 50), from, "");
    const lastAtIndex = text.lastIndexOf("@");
    if (lastAtIndex !== -1) {
      const deleteFrom = from - (text.length - lastAtIndex);
      editor.chain()
        .focus()
        .deleteRange({ from: deleteFrom, to: from })
        .insertContent(`<a href="/user/${userId}" data-mention="user" class="inline-flex items-center gap-0.5 bg-primary/10 text-primary border border-primary/20 rounded-md px-1.5 py-0.5 text-xs font-medium mx-0.5 no-underline hover:bg-primary/20 transition-colors">@${userName}</a> `)
        .run();
    }
    setShowSlashMenu(false);
  }, [editor]);

  const insertDemandMention = useCallback((demandId: string, demandCode: string) => {
    if (!editor) return;
    
    const { from } = editor.state.selection;
    const text = editor.state.doc.textBetween(Math.max(0, from - 50), from, "");
    const lastHashIndex = text.lastIndexOf("#");
    if (lastHashIndex !== -1) {
      const deleteFrom = from - (text.length - lastHashIndex);
      editor.chain()
        .focus()
        .deleteRange({ from: deleteFrom, to: from })
        .insertContent(`<a href="/demands/${demandId}" data-mention="demand" class="inline-flex items-center gap-0.5 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 rounded-md px-1.5 py-0.5 text-xs font-medium mx-0.5 no-underline hover:bg-cyan-500/20 transition-colors">#${demandCode}</a> `)
        .run();
    }
    setShowSlashMenu(false);
  }, [editor]);

  const insertNoteMention = useCallback((noteId: string, noteTitle: string, noteIcon: string) => {
    if (!editor) return;
    
    const { from } = editor.state.selection;
    const text = editor.state.doc.textBetween(Math.max(0, from - 50), from, "");
    const lastBracketIndex = text.lastIndexOf("[[");
    if (lastBracketIndex !== -1) {
      const deleteFrom = from - (text.length - lastBracketIndex);
      editor.chain()
        .focus()
        .deleteRange({ from: deleteFrom, to: from })
        .insertContent(`<a href="/notes/${noteId}" data-mention="note" class="inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 rounded-md px-1.5 py-0.5 text-xs font-medium mx-0.5 no-underline hover:bg-amber-500/20 transition-colors">${noteIcon} ${noteTitle}</a> `)
        .run();
    }
    setShowSlashMenu(false);
  }, [editor]);

  const insertCallout = useCallback((type: string) => {
    if (!editor) return;
    const callout = CALLOUT_TYPES.find(c => c.type === type);
    if (!callout) return;
    
    editor.chain().focus().insertContent(`
      <div class="callout callout-${type} flex gap-3 p-4 my-4 rounded-lg border ${callout.bgClass} ${callout.borderClass}">
        <span class="text-lg">${type === 'info' ? 'ℹ️' : type === 'warning' ? '⚠️' : type === 'error' ? '🚨' : '💡'}</span>
        <div class="flex-1">Digite aqui...</div>
      </div>
    `).run();
  }, [editor]);

  const insertTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const insertToggle = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent(`
      <details class="my-2 p-3 rounded-lg border bg-muted/30">
        <summary class="cursor-pointer font-medium">Clique para expandir</summary>
        <div class="mt-2 pl-4">Conteúdo oculto...</div>
      </details>
    `).run();
  }, [editor]);

  const insertColumns = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertContent(`
      <div class="grid grid-cols-2 gap-4 my-4">
        <div class="p-4 rounded-lg border bg-muted/20">Coluna 1</div>
        <div class="p-4 rounded-lg border bg-muted/20">Coluna 2</div>
      </div>
    `).run();
  }, [editor]);

  const setLink = useCallback(() => {
    if (!editor || !linkUrl) return;
    
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    setShowLinkInput(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  const removeLink = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().unsetLink().run();
  }, [editor]);

  const slashCommands: SlashCommand[] = [
    // Básico
    { icon: Type, label: "Texto", description: "Texto simples", action: () => editor?.chain().focus().setParagraph().run(), category: "Básico" },
    { icon: Heading1, label: "Título 1", description: "Título grande", action: () => editor?.chain().focus().toggleHeading({ level: 1 }).run(), category: "Básico" },
    { icon: Heading2, label: "Título 2", description: "Título médio", action: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(), category: "Básico" },
    { icon: Heading3, label: "Título 3", description: "Título pequeno", action: () => editor?.chain().focus().toggleHeading({ level: 3 }).run(), category: "Básico" },
    
    // Listas
    { icon: List, label: "Lista", description: "Lista com marcadores", action: () => editor?.chain().focus().toggleBulletList().run(), category: "Listas" },
    { icon: ListOrdered, label: "Lista Numerada", description: "Lista numerada", action: () => editor?.chain().focus().toggleOrderedList().run(), category: "Listas" },
    { icon: CheckSquare, label: "Lista de Tarefas", description: "Checklist interativa", action: () => editor?.chain().focus().toggleTaskList().run(), category: "Listas" },
    
    // Blocos
    { icon: Quote, label: "Citação", description: "Bloco de citação", action: () => editor?.chain().focus().toggleBlockquote().run(), category: "Blocos" },
    { icon: FileCode, label: "Código", description: "Bloco de código com syntax highlight", action: () => editor?.chain().focus().toggleCodeBlock().run(), category: "Blocos" },
    { icon: Minus, label: "Divisor", description: "Linha divisória", action: () => editor?.chain().focus().setHorizontalRule().run(), category: "Blocos" },
    { icon: ToggleRight, label: "Toggle", description: "Bloco expansível", action: () => { setShowSlashMenu(false); insertToggle(); }, category: "Blocos" },
    { icon: Columns, label: "Colunas", description: "Layout em 2 colunas", action: () => { setShowSlashMenu(false); insertColumns(); }, category: "Blocos" },
    
    // Callouts
    { icon: Info, label: "Info", description: "Bloco de informação", action: () => { setShowSlashMenu(false); insertCallout("info"); }, category: "Callouts" },
    { icon: AlertTriangle, label: "Aviso", description: "Bloco de aviso", action: () => { setShowSlashMenu(false); insertCallout("warning"); }, category: "Callouts" },
    { icon: AlertCircle, label: "Alerta", description: "Bloco de alerta", action: () => { setShowSlashMenu(false); insertCallout("error"); }, category: "Callouts" },
    { icon: Lightbulb, label: "Dica", description: "Bloco de dica", action: () => { setShowSlashMenu(false); insertCallout("tip"); }, category: "Callouts" },
    
    // Tabela
    { icon: TableIcon, label: "Tabela", description: "Inserir tabela 3x3", action: () => { setShowSlashMenu(false); insertTable(); }, category: "Avançado" },
    
    // Mídia
    { icon: ImageIcon, label: "Imagem", description: "Inserir imagem", action: () => { setShowSlashMenu(false); handleImageUpload(); }, category: "Mídia" },
    { icon: Video, label: "Vídeo", description: "Inserir vídeo", action: () => { setShowSlashMenu(false); videoInputRef.current?.click(); }, category: "Mídia" },
    { icon: FileText, label: "Documento", description: "Anexar arquivo", action: () => { setShowSlashMenu(false); docInputRef.current?.click(); }, category: "Mídia" },
    { icon: LinkIcon, label: "Link", description: "Adicionar link", action: () => { setShowSlashMenu(false); setShowLinkInput(true); }, category: "Mídia" },
    
    // Menções
    { icon: AtSign, label: "Mencionar pessoa", description: "Mencionar usuário (@)", action: () => { setMenuMode("users"); setSlashFilter(""); setSelectedIndex(0); }, category: "Menções" },
    { icon: Hash, label: "Mencionar demanda", description: "Mencionar demanda (#)", action: () => { setMenuMode("demands"); setSlashFilter(""); setSelectedIndex(0); }, category: "Menções" },
    { icon: FileText, label: "Mencionar nota", description: "Link para nota ([[)", action: () => { setMenuMode("notes"); setSlashFilter(""); setSelectedIndex(0); }, category: "Menções" },
  ];

  const getFilteredItems = useCallback(() => {
    if (menuMode === "commands") {
      return slashCommands.filter(cmd => 
        cmd.label.toLowerCase().includes(slashFilter.toLowerCase()) ||
        cmd.description?.toLowerCase().includes(slashFilter.toLowerCase())
      );
    }
    if (menuMode === "users") {
      return teamMembers.filter(member =>
        member.profile.full_name.toLowerCase().includes(slashFilter.toLowerCase())
      );
    }
    if (menuMode === "demands") {
      return demandsList.filter(demand =>
        demand.title.toLowerCase().includes(slashFilter.toLowerCase()) ||
        demand.board_sequence_number.toString().includes(slashFilter)
      );
    }
    if (menuMode === "notes") {
      return notesList.filter(note =>
        note.title.toLowerCase().includes(slashFilter.toLowerCase())
      );
    }
    return [];
  }, [menuMode, slashFilter, slashCommands, teamMembers, demandsList, notesList]);

  const selectItem = useCallback((index: number) => {
    const items = getFilteredItems();
    if (index >= items.length || !editor) return;

    const currentMenuMode = menuModeRef.current;

    if (currentMenuMode === "commands") {
      const cmd = items[index] as SlashCommand;

      // Remove the "/" + filter text while keeping the editor selection.
      // (Important: menu clicks can steal focus; we also preventDefault on mousedown in the menu items.)
      const { from } = editor.state.selection;
      const text = editor.state.doc.textBetween(Math.max(0, from - 50), from, "");
      const lastSlashIndex = text.lastIndexOf("/");

      if (lastSlashIndex !== -1) {
        const deleteFrom = from - (text.length - lastSlashIndex);
        editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).run();
      } else {
        editor.chain().focus().run();
      }

      // Execute the command
      cmd.action();

      // Keep menu open only when the command switches mode (Menções)
      if (cmd.category !== "Menções") {
        setShowSlashMenu(false);
      }
    } else if (currentMenuMode === "users") {
      const member = items[index] as typeof teamMembers[0];
      insertUserMention(member.user_id, member.profile.full_name);
    } else if (currentMenuMode === "demands") {
      const demand = items[index] as typeof demandsList[0];
      insertDemandMention(demand.id, demand.board_sequence_number.toString());
    } else if (currentMenuMode === "notes") {
      const note = items[index] as typeof notesList[0];
      insertNoteMention(note.id, note.title, note.icon || "📝");
    }
  }, [getFilteredItems, editor, insertUserMention, insertDemandMention, insertNoteMention, teamMembers, demandsList, notesList]);

  // Scroll selected item into view and wrap around
  useEffect(() => {
    if (showSlashMenu && menuRef.current) {
      const items = getFilteredItems();
      const maxIndex = items.length - 1;
      
      if (selectedIndex > maxIndex && maxIndex >= 0) {
        setSelectedIndex(0);
        return;
      }
      if (selectedIndex < 0 && maxIndex >= 0) {
        setSelectedIndex(maxIndex);
        return;
      }
      
      const selectedElement = menuRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex, showSlashMenu, getFilteredItems]);

  // Listen for selection event from keyboard
  useEffect(() => {
    const handleSelectEvent = () => {
      if (showSlashMenuRef.current) {
        selectItem(selectedIndexRef.current);
      }
    };
    
    window.addEventListener('notion-editor-select', handleSelectEvent);
    return () => window.removeEventListener('notion-editor-select', handleSelectEvent);
  }, [selectItem]);

  // Close menu when clicking outside or on scroll
  useEffect(() => {
    if (!showSlashMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        // Don't close if clicking on the editor
        const editorElement = document.querySelector('.ProseMirror');
        if (editorElement?.contains(target)) return;
        setShowSlashMenu(false);
      }
    };

    const handleScroll = (e: Event) => {
      // Close menu on scroll outside of the menu itself
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowSlashMenu(false);
      }
    };

    const handleResize = () => {
      setShowSlashMenu(false);
    };

    // Add listeners with a small delay to avoid closing immediately
    const timeout = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside, true);
      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleResize);
    }, 50);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handleClickOutside, true);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [showSlashMenu]);

  // Adjust menu position to stay within viewport with smooth recalculation
  const adjustedPosition = useMemo(() => {
    if (!showSlashMenu) return slashMenuPosition;
    
    const menuWidth = 340;
    const menuHeight = Math.min(400, window.innerHeight * 0.6);
    const padding = 12;
    
    let { top, left } = slashMenuPosition;
    
    if (typeof window !== "undefined") {
      // Clamp horizontal position
      const maxLeft = window.innerWidth - menuWidth - padding;
      left = Math.max(padding, Math.min(left, maxLeft));
      
      // Clamp vertical position - prefer showing below, flip above if needed
      const spaceBelow = window.innerHeight - top - padding;
      const spaceAbove = slashMenuPosition.top - 40 - padding;
      
      if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
        // Show above cursor
        top = Math.max(padding, slashMenuPosition.top - menuHeight - 40);
      } else {
        // Ensure menu doesn't go below viewport
        top = Math.min(top, window.innerHeight - menuHeight - padding);
      }
    }
    
    return { top, left };
  }, [showSlashMenu, slashMenuPosition]);

  if (!editor) return null;

  const filteredItems = getFilteredItems();
  
  // Group commands by category
  const groupedCommands: Record<string, SlashCommand[]> = {};
  if (menuMode === "commands") {
    (filteredItems as SlashCommand[]).forEach(cmd => {
      const category = cmd.category;
      if (!groupedCommands[category]) groupedCommands[category] = [];
      groupedCommands[category].push(cmd);
    });
  }

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleVideoUpload}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
        className="hidden"
        onChange={handleDocUpload}
      />

      {/* Link Input Modal */}
      {showLinkInput && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowLinkInput(false)} />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-background border rounded-lg shadow-lg p-4 w-96">
            <h3 className="font-medium mb-3">Adicionar Link</h3>
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://exemplo.com"
              onKeyDown={(e) => e.key === "Enter" && setLink()}
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <Button onClick={setLink} size="sm">Adicionar</Button>
              <Button onClick={() => setShowLinkInput(false)} variant="outline" size="sm">Cancelar</Button>
            </div>
          </div>
        </>
      )}

      {/* Bubble Menu - appears when text is selected */}
      {editor && (
        <BubbleMenu 
          editor={editor} 
          tippyOptions={{ duration: 100 }}
          className="flex items-center gap-0.5 p-1 rounded-lg border bg-background shadow-lg"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={cn("h-8 w-8 p-0", editor.isActive("bold") && "bg-muted")}
            title="Negrito (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={cn("h-8 w-8 p-0", editor.isActive("italic") && "bg-muted")}
            title="Itálico (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={cn("h-8 w-8 p-0", editor.isActive("underline") && "bg-muted")}
            title="Sublinhado (Ctrl+U)"
          >
            <UnderlineIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={cn("h-8 w-8 p-0", editor.isActive("strike") && "bg-muted")}
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={cn("h-8 w-8 p-0", editor.isActive("code") && "bg-muted")}
          >
            <Code className="h-4 w-4" />
          </Button>
          
          <div className="w-px h-4 bg-border mx-1" />
          
          {/* Link buttons */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowLinkInput(true)}
            className={cn("h-8 w-8 p-0", editor.isActive("link") && "bg-muted")}
            title="Link (Ctrl+K)"
          >
            <LinkIcon className="h-4 w-4" />
          </Button>
          {editor.isActive("link") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={removeLink}
              className="h-8 w-8 p-0 text-destructive"
              title="Remover link"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          
          <div className="w-px h-4 bg-border mx-1" />
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn("h-8 w-8 p-0", editor.isActive("highlight") && "bg-muted")}
              >
                <Highlighter className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="flex gap-1">
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color.color}
                    onClick={() => editor.chain().focus().toggleHighlight({ color: color.color }).run()}
                    className="w-6 h-6 rounded border hover:scale-110 transition-transform"
                    style={{ backgroundColor: color.color }}
                    title={color.name}
                  />
                ))}
                <button
                  onClick={() => editor.chain().focus().unsetHighlight().run()}
                  className="w-6 h-6 rounded border bg-background hover:bg-muted flex items-center justify-center text-xs"
                  title="Remover"
                >
                  ✕
                </button>
              </div>
            </PopoverContent>
          </Popover>
          
          <div className="w-px h-4 bg-border mx-1" />
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "left" }) && "bg-muted")}
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "center" }) && "bg-muted")}
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className={cn("h-8 w-8 p-0", editor.isActive({ textAlign: "right" }) && "bg-muted")}
          >
            <AlignRight className="h-4 w-4" />
          </Button>
        </BubbleMenu>
      )}

      {/* Table Controls - shown when inside a table */}
      {editor.isActive("table") && (
        <div className="flex items-center gap-1 mb-2 p-2 rounded-lg border bg-muted/50">
          <span className="text-xs text-muted-foreground mr-2">Tabela:</span>
          <Button variant="outline" size="sm" onClick={() => editor.chain().focus().addColumnBefore().run()}>
            + Coluna Antes
          </Button>
          <Button variant="outline" size="sm" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            + Coluna Depois
          </Button>
          <Button variant="outline" size="sm" onClick={() => editor.chain().focus().addRowBefore().run()}>
            + Linha Antes
          </Button>
          <Button variant="outline" size="sm" onClick={() => editor.chain().focus().addRowAfter().run()}>
            + Linha Depois
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          <Button variant="outline" size="sm" onClick={() => editor.chain().focus().deleteColumn().run()} className="text-destructive">
            Remover Coluna
          </Button>
          <Button variant="outline" size="sm" onClick={() => editor.chain().focus().deleteRow().run()} className="text-destructive">
            Remover Linha
          </Button>
          <Button variant="outline" size="sm" onClick={() => editor.chain().focus().deleteTable().run()} className="text-destructive">
            Remover Tabela
          </Button>
        </div>
      )}

      {/* Slash Command / Mention Menu */}
      {showSlashMenu && (
        <div 
          ref={menuRef}
          role="listbox"
          aria-label="Menu de comandos"
          className="fixed z-[100] bg-popover border border-border rounded-xl shadow-2xl shadow-black/20 dark:shadow-black/40 p-1.5 min-w-[320px] max-w-[360px] max-h-[min(400px,60vh)] overflow-y-auto overscroll-contain scroll-smooth"
          style={{ 
            top: adjustedPosition.top, 
            left: adjustedPosition.left,
            animation: 'fadeInScale 150ms ease-out forwards',
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <style>{`
            @keyframes fadeInScale {
              from {
                opacity: 0;
                transform: scale(0.96) translateY(-4px);
              }
              to {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }
          `}</style>
          <div className="text-[11px] text-muted-foreground px-2.5 py-2 border-b border-border/50 mb-1.5 flex items-center justify-between sticky top-0 bg-popover -mt-1.5 -mx-1.5 px-3 rounded-t-xl">
            <span className="font-medium">
              {menuMode === "commands" && "Blocos e ações"}
              {menuMode === "users" && "Mencionar pessoa"}
              {menuMode === "demands" && "Mencionar demanda"}
              {menuMode === "notes" && "Link para nota"}
            </span>
            <span className="text-[10px] opacity-50 font-mono">↑↓ · Enter · Esc</span>
          </div>
          
          {menuMode === "commands" && (
            <>
              {Object.keys(groupedCommands).length > 0 ? (
                Object.entries(groupedCommands).map(([category, commands]) => (
                  <div key={category} className="mb-2">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1 font-medium">
                      {category}
                    </div>
                    {(commands as SlashCommand[]).map((cmd) => {
                      const globalIndex = filteredItems.findIndex(item => item === cmd);
                      return (
                        <button
                          key={cmd.label}
                          data-index={globalIndex}
                          role="option"
                          aria-selected={selectedIndex === globalIndex}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            selectItem(globalIndex);
                          }}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          className={cn(
                            "flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-left text-sm transition-all duration-150 outline-none",
                            selectedIndex === globalIndex 
                              ? "bg-primary/10 text-primary shadow-sm" 
                              : "hover:bg-muted/80"
                          )}
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-150",
                            selectedIndex === globalIndex ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                          )}>
                            <cmd.icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{cmd.label}</div>
                            {cmd.description && (
                              <div className="text-xs text-muted-foreground truncate">{cmd.description}</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Nenhum comando encontrado
                </div>
              )}
            </>
          )}
          
          {menuMode === "users" && (
            <>
              {(filteredItems as typeof teamMembers).length > 0 ? (
                (filteredItems as typeof teamMembers).map((member, index) => (
                  <button
                    key={member.user_id}
                    data-index={index}
                    role="option"
                    aria-selected={selectedIndex === index}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      selectItem(index);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-left text-sm transition-all duration-150 outline-none",
                      selectedIndex === index 
                        ? "bg-primary/10 text-primary shadow-sm" 
                        : "hover:bg-muted/80"
                    )}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member.profile.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {member.profile.full_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{member.profile.full_name}</div>
                      <div className="text-xs text-muted-foreground">{member.role}</div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  {teamMembers.length === 0 ? "Nenhum membro no time" : "Nenhum usuário encontrado"}
                </div>
              )}
            </>
          )}
          
          {menuMode === "demands" && (
            <>
              {(filteredItems as typeof demandsList).length > 0 ? (
                (filteredItems as typeof demandsList).map((demand, index) => (
                  <button
                    key={demand.id}
                    data-index={index}
                    role="option"
                    aria-selected={selectedIndex === index}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      selectItem(index);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-left text-sm transition-all duration-150 outline-none",
                      selectedIndex === index 
                        ? "bg-accent text-accent-foreground shadow-sm" 
                        : "hover:bg-muted/80"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center font-mono text-sm font-bold",
                      selectedIndex === index ? "bg-accent" : "bg-muted"
                    )}>
                      #{demand.board_sequence_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{demand.title}</div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  {demandsList.length === 0 ? "Nenhuma demanda no quadro" : "Nenhuma demanda encontrada"}
                </div>
              )}
            </>
          )}
          
          {menuMode === "notes" && (
            <>
              {(filteredItems as typeof notesList).length > 0 ? (
                (filteredItems as typeof notesList).map((note, index) => (
                  <button
                    key={note.id}
                    data-index={index}
                    role="option"
                    aria-selected={selectedIndex === index}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      selectItem(index);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={cn(
                      "flex items-center gap-3 w-full px-2.5 py-2 rounded-lg text-left text-sm transition-all duration-150 outline-none",
                      selectedIndex === index 
                        ? "bg-accent text-accent-foreground shadow-sm" 
                        : "hover:bg-muted/80"
                    )}
                  >
                    <span className="text-xl shrink-0">{note.icon || "📝"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{note.title}</div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4">
                  {notesList.length === 0 ? "Nenhuma nota criada" : "Nenhuma nota encontrada"}
                </div>
              )}
            </>
          )}
        </div>
      )}


      <EditorContent editor={editor} className={cn(isUploading && "opacity-50 pointer-events-none")} />

      {/* Floating add button */}
      {editable && (
        <div className="absolute left-0 top-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 hover:opacity-100 transition-opacity">
                <Plus className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <div className="text-xs text-muted-foreground px-2 pb-2 border-b mb-2">
                Inserir bloco
              </div>
              <div className="max-h-64 overflow-y-auto">
                {slashCommands.slice(0, 15).map((cmd) => (
                  <button
                    key={cmd.label}
                    onClick={() => cmd.action()}
                    className="flex items-center gap-3 w-full px-2 py-1.5 rounded hover:bg-muted text-left text-sm transition-colors"
                  >
                    <cmd.icon className="h-4 w-4 text-muted-foreground" />
                    <span>{cmd.label}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Keyboard shortcuts help */}
      <div className="mt-4 pt-4 border-t">
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground transition-colors">Atalhos de teclado</summary>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2 p-2 bg-muted/30 rounded-lg">
            <div><kbd className="px-1 bg-muted rounded">Ctrl+B</kbd> Negrito</div>
            <div><kbd className="px-1 bg-muted rounded">Ctrl+I</kbd> Itálico</div>
            <div><kbd className="px-1 bg-muted rounded">Ctrl+U</kbd> Sublinhado</div>
            <div><kbd className="px-1 bg-muted rounded">Ctrl+K</kbd> Link</div>
            <div><kbd className="px-1 bg-muted rounded">/</kbd> Comandos</div>
            <div><kbd className="px-1 bg-muted rounded">@</kbd> Mencionar</div>
            <div><kbd className="px-1 bg-muted rounded">#</kbd> Demanda</div>
            <div><kbd className="px-1 bg-muted rounded">[[</kbd> Link nota</div>
          </div>
        </details>
      </div>

      <style>{`
        .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground));
          pointer-events: none;
          height: 0;
        }
        
        .ProseMirror {
          outline: none;
        }
        
        .ProseMirror h1 {
          font-size: 2em;
          font-weight: 700;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
        }
        
        .ProseMirror h2 {
          font-size: 1.5em;
          font-weight: 600;
          margin-top: 1.25em;
          margin-bottom: 0.5em;
        }
        
        .ProseMirror h3 {
          font-size: 1.25em;
          font-weight: 600;
          margin-top: 1em;
          margin-bottom: 0.5em;
        }
        
        .ProseMirror blockquote {
          border-left: 3px solid hsl(var(--border));
          padding-left: 1em;
          margin-left: 0;
          color: hsl(var(--muted-foreground));
        }
        
        .ProseMirror pre {
          background: hsl(var(--muted));
          border-radius: 0.5rem;
          padding: 1rem;
          overflow-x: auto;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        
        .ProseMirror code {
          background: hsl(var(--muted));
          padding: 0.2em 0.4em;
          border-radius: 0.25rem;
          font-size: 0.875em;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        
        .ProseMirror hr {
          border: none;
          border-top: 1px solid hsl(var(--border));
          margin: 2em 0;
        }
        
        .ProseMirror ul, .ProseMirror ol {
          padding-left: 1.5em;
        }

        .ProseMirror ul {
          list-style: disc;
        }

        .ProseMirror ol {
          list-style: decimal;
        }
        
        .ProseMirror li {
          margin: 0.25em 0;
        }
        
        .ProseMirror a[data-mention] {
          text-decoration: none;
          cursor: pointer;
        }
        
        /* Task List Styles */
        .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding-left: 0;
        }
        
        .ProseMirror ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
        }
        
        .ProseMirror ul[data-type="taskList"] li > label {
          flex-shrink: 0;
          margin-top: 0.25rem;
        }
        
        .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"] {
          width: 1rem;
          height: 1rem;
          cursor: pointer;
          accent-color: hsl(var(--primary));
        }
        
        .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div {
          text-decoration: line-through;
          color: hsl(var(--muted-foreground));
        }
        
        /* Table Styles */
        .ProseMirror table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
          overflow: hidden;
        }
        
        .ProseMirror table td,
        .ProseMirror table th {
          border: 1px solid hsl(var(--border));
          padding: 0.5rem 0.75rem;
          min-width: 100px;
          vertical-align: top;
          text-align: left;
        }
        
        .ProseMirror table th {
          background: hsl(var(--muted));
          font-weight: 600;
        }
        
        .ProseMirror table .selectedCell {
          background: hsl(var(--primary) / 0.1);
        }
        
        /* Callout Styles */
        .ProseMirror .callout {
          padding: 1rem;
          border-radius: 0.5rem;
          margin: 1rem 0;
        }
        
        /* Code Block with Syntax Highlighting */
        .ProseMirror .code-block {
          background: hsl(var(--muted));
          border-radius: 0.5rem;
          padding: 1rem;
          overflow-x: auto;
        }
        
        .ProseMirror .code-block code {
          background: none;
          padding: 0;
          font-size: 0.875rem;
        }
        
        /* Syntax highlighting colors */
        .hljs-comment,
        .hljs-quote {
          color: #6a737d;
        }
        
        .hljs-keyword,
        .hljs-selector-tag,
        .hljs-addition {
          color: #d73a49;
        }
        
        .hljs-number,
        .hljs-string,
        .hljs-meta .hljs-meta-string,
        .hljs-literal,
        .hljs-doctag,
        .hljs-regexp {
          color: #032f62;
        }
        
        .hljs-title,
        .hljs-section,
        .hljs-name,
        .hljs-selector-id,
        .hljs-selector-class {
          color: #6f42c1;
        }
        
        .hljs-attribute,
        .hljs-attr,
        .hljs-variable,
        .hljs-template-variable,
        .hljs-class .hljs-title,
        .hljs-type {
          color: #005cc5;
        }
        
        .hljs-symbol,
        .hljs-bullet,
        .hljs-subst,
        .hljs-meta,
        .hljs-meta .hljs-keyword,
        .hljs-selector-attr,
        .hljs-selector-pseudo,
        .hljs-link {
          color: #e36209;
        }
        
        .hljs-built_in,
        .hljs-deletion {
          color: #22863a;
        }
        
        /* Dark mode syntax highlighting */
        .dark .hljs-comment,
        .dark .hljs-quote {
          color: #8b949e;
        }
        
        .dark .hljs-keyword,
        .dark .hljs-selector-tag,
        .dark .hljs-addition {
          color: #ff7b72;
        }
        
        .dark .hljs-number,
        .dark .hljs-string,
        .dark .hljs-meta .hljs-meta-string,
        .dark .hljs-literal,
        .dark .hljs-doctag,
        .dark .hljs-regexp {
          color: #a5d6ff;
        }
        
        .dark .hljs-title,
        .dark .hljs-section,
        .dark .hljs-name,
        .dark .hljs-selector-id,
        .dark .hljs-selector-class {
          color: #d2a8ff;
        }
        
        .dark .hljs-attribute,
        .dark .hljs-attr,
        .dark .hljs-variable,
        .dark .hljs-template-variable,
        .dark .hljs-class .hljs-title,
        .dark .hljs-type {
          color: #79c0ff;
        }
        
        .dark .hljs-symbol,
        .dark .hljs-bullet,
        .dark .hljs-subst,
        .dark .hljs-meta,
        .dark .hljs-meta .hljs-keyword,
        .dark .hljs-selector-attr,
        .dark .hljs-selector-pseudo,
        .dark .hljs-link {
          color: #ffa657;
        }
        
        .dark .hljs-built_in,
        .dark .hljs-deletion {
          color: #7ee787;
        }
      `}</style>
    </div>
  );
}
