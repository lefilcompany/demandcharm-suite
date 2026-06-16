import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FileText, Loader2, X, Plus, LayoutDashboard, Columns3, ClipboardList, Clock, StickyNote } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { useSelectedBoardSafe } from "@/contexts/BoardContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useCreateDemandModal } from "@/contexts/CreateDemandContext";
import { cn } from "@/lib/utils";

const priorityColors: Record<string, string> = {
  alta: "text-destructive",
  urgente: "text-destructive",
  média: "text-amber-500",
  baixa: "text-muted-foreground",
};

export function GlobalSearchBar() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { currentBoard } = useSelectedBoardSafe();
  const { openCreateDemand } = useCreateDemandModal();
  const isMobile = useIsMobile();

  const { data: results, isLoading } = useGlobalSearch(query, currentBoard?.id || null);

  useEffect(() => {
    setSelectedIndex(-1);
  }, [results]);

  const collapse = useCallback(() => {
    setExpanded(false);
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(-1);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setQuery("");
    setSelectedIndex(-1);
  }, []);

  // Close when clicking outside (desktop only)
  useEffect(() => {
    if (isMobile) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        collapse();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [collapse, isMobile]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (isMobile) closeModal();
      else collapse();
      return;
    }

    if (!results || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex].link);
        }
        break;
    }
  };

  // Global Escape to collapse (desktop)
  useEffect(() => {
    if (isMobile) return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && expanded) {
        collapse();
      }
    };
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [expanded, collapse, isMobile]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const items = resultsRef.current.querySelectorAll("[data-result-item]");
      if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  const handleSelect = (link: string) => {
    navigate(link);
    if (isMobile) closeModal();
    else collapse();
  };

  const handleButtonClick = () => {
    if (isMobile) {
      setModalOpen(true);
      setTimeout(() => modalInputRef.current?.focus(), 100);
    } else {
      if (expanded) {
        collapse();
      } else {
        setExpanded(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }
  };

  const getIcon = (result: { type: string; avatarUrl?: string; title?: string; statusColor?: string }) => {
    if (result.type === "member" || result.type === "user") {
      const initials = result.title
        ?.split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "?";
      return (
        <Avatar className="h-7 w-7">
          <AvatarImage src={result.avatarUrl} />
          <AvatarFallback className={`text-xs ${result.type === "member" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"}`}>
            {initials}
          </AvatarFallback>
        </Avatar>
      );
    }
    if (result.type === "demand") {
      return (
        <div
          className="h-7 w-7 rounded-md flex items-center justify-center shrink-0"
          style={{
            backgroundColor: result.statusColor ? `${result.statusColor}20` : undefined,
          }}
        >
          <FileText
            className="h-3.5 w-3.5"
            style={{ color: result.statusColor || undefined }}
          />
        </div>
      );
    }
    return <Search className="h-4 w-4" />;
  };

  // Group results by type
  const demandResults = results?.filter(r => r.type === "demand") || [];
  const peopleResults = results?.filter(r => r.type === "member" || r.type === "user") || [];

  const renderResultItem = (result: typeof results extends (infer T)[] | undefined ? T : never, globalIndex: number) => (
    <button
      key={`${result.type}-${result.id}`}
      data-result-item
      onClick={() => handleSelect(result.link)}
      onMouseEnter={() => setSelectedIndex(globalIndex)}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 transition-colors text-left",
        selectedIndex === globalIndex ? "bg-muted" : "hover:bg-muted/50"
      )}
    >
      <div className="shrink-0">{getIcon(result)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{result.title}</p>
        {result.subtitle && (
          <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
        )}
        {result.extra && (
          <p className="text-[10px] text-muted-foreground/70 truncate">{result.extra}</p>
        )}
      </div>
      {result.priority && (
        <span className={cn("text-[10px] font-medium capitalize shrink-0", priorityColors[result.priority] || "text-muted-foreground")}>
          {result.priority}
        </span>
      )}
    </button>
  );

  const renderResults = () => {
    if (query.length < 2) return null;

    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (results && results.length > 0) {
      return (
        <div ref={resultsRef} className="max-h-[380px] overflow-y-auto">
          {demandResults.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 border-b border-border/50 flex items-center gap-1.5">
                <FileText className="h-3 w-3" />
                Demandas ({demandResults.length})
              </div>
              {demandResults.map((result, i) => renderResultItem(result, i))}
            </>
          )}
          {peopleResults.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/30 border-b border-border/50 border-t flex items-center gap-1.5">
                <Search className="h-3 w-3" />
                Pessoas ({peopleResults.length})
              </div>
              {peopleResults.map((result, i) => renderResultItem(result, demandResults.length + i))}
            </>
          )}
        </div>
      );
    }

    return (
      <div className="py-6 text-center text-sm text-muted-foreground">
        Nenhum resultado para "{query}"
      </div>
    );
  };

  return (
    <>
      <div ref={containerRef} className="relative flex items-center">
        {/* Mobile: simple icon button that opens modal */}
        {isMobile ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={handleButtonClick}
            title="Pesquisar (⌘K)"
          >
            <Search className="h-4 w-4" />
          </Button>
        ) : (
          /* Desktop: container that grows laterally */
          <div
            className={cn(
              "group flex items-center transition-all duration-300 ease-in-out rounded-full border overflow-hidden shrink-0",
              expanded
                ? "w-[200px] sm:w-[260px] border-primary/40 bg-background shadow-sm ring-1 ring-primary/10"
                : "w-7 border-transparent bg-transparent hover:w-32 hover:border-border hover:bg-muted/40 hover:shadow-sm cursor-pointer"
            )}
            onClick={() => { if (!expanded) handleButtonClick(); }}
          >
            <button
              type="button"
              className={cn(
                "h-7 w-7 shrink-0 flex items-center justify-center transition-colors rounded-l-full",
                expanded ? "text-primary" : "text-muted-foreground group-hover:text-[#F28705]"
              )}
              onClick={(e) => {
                e.stopPropagation();
                if (expanded) collapse();
                else handleButtonClick();
              }}
              title="Pesquisar (⌘K)"
            >
              {expanded ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>
            {expanded ? (
              <input
                ref={inputRef}
                type="text"
                placeholder="Buscar demandas, membros..."
                value={query}
                onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
                onKeyDown={handleKeyDown}
                className="h-7 w-full bg-transparent text-xs outline-none pr-3 text-foreground placeholder:text-muted-foreground/60"
              />
            ) : (
              <span className="text-[11px] text-muted-foreground/70 pr-3 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                Pesquisar
              </span>
            )}
          </div>
        )}

        {/* Results dropdown (desktop only) */}
        {expanded && !isMobile && isOpen && query.length >= 2 && (
          <div className="absolute top-full right-0 mt-2 w-[300px] sm:w-[360px] bg-popover border border-border rounded-lg shadow-xl z-[9999] overflow-hidden">
            {renderResults()}
            <div className="px-3 py-1.5 border-t border-border/50 bg-muted/20">
              <p className="text-[10px] text-muted-foreground">
                <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">↑↓</kbd> navegar · <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">Enter</kbd> abrir · <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">Esc</kbd> fechar
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Search modal (mobile/tablet) */}
      <Dialog open={modalOpen} onOpenChange={(open) => { if (!open) closeModal(); }}>
        <DialogContent className="sm:max-w-[420px] p-0 gap-0 top-[10%] translate-y-0">
          <div className="flex items-center gap-2 p-3 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <Input
              ref={modalInputRef}
              type="text"
              placeholder="Buscar demandas, membros..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="border-0 h-8 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
              autoFocus
            />
            {query && (
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setQuery("")}>
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="min-h-[100px]">
            {query.length < 2 ? (
              <div className="p-2 space-y-1">
                <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ações rápidas</p>
                {[
                  { icon: <Plus className="h-4 w-4" />, label: "Nova Demanda", action: () => { closeModal(); openCreateDemand(); } },
                  { icon: <Columns3 className="h-4 w-4" />, label: "Kanban", action: () => { closeModal(); navigate("/kanban"); } },
                  { icon: <ClipboardList className="h-4 w-4" />, label: "Demandas", action: () => { closeModal(); navigate("/demands"); } },
                  { icon: <LayoutDashboard className="h-4 w-4" />, label: "Dashboard", action: () => { closeModal(); navigate("/"); } },
                  { icon: <Clock className="h-4 w-4" />, label: "Gerenciamento de Tempo", action: () => { closeModal(); navigate("/time-management"); } },
                  { icon: <StickyNote className="h-4 w-4" />, label: "Notas", action: () => { closeModal(); navigate("/notes"); } },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-muted-foreground">{item.icon}</span>
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              renderResults()
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
