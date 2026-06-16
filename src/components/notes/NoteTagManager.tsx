import { useState, useRef, useEffect, useMemo } from "react";
import { Tag, X, Plus, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useNoteTags, useCreateNoteTag } from "@/hooks/useNoteTags";

interface NoteTagManagerProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}

export function NoteTagManager({ tags, onTagsChange }: NoteTagManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { data: teamTags = [], isLoading } = useNoteTags();
  const createTag = useCreateNoteTag();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Filter available tags based on search
  const filteredTags = useMemo(() => {
    const searchLower = search.toLowerCase().trim();
    return teamTags.filter(tag => 
      tag.name.toLowerCase().includes(searchLower)
    );
  }, [teamTags, search]);

  // Check if search term matches an existing tag
  const searchMatchesExisting = useMemo(() => {
    const searchLower = search.toLowerCase().trim();
    return teamTags.some(tag => tag.name === searchLower);
  }, [teamTags, search]);

  // Check if we can create a new tag
  const canCreateNew = search.trim().length > 0 && !searchMatchesExisting;

  const handleToggleTag = (tagName: string) => {
    if (tags.includes(tagName)) {
      onTagsChange(tags.filter(t => t !== tagName));
    } else {
      onTagsChange([...tags, tagName]);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!canCreateNew) return;
    
    const newTagName = search.toLowerCase().trim();
    
    try {
      await createTag.mutateAsync({ name: newTagName });
      onTagsChange([...tags, newTagName]);
      setSearch("");
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (canCreateNew) {
        handleCreateAndAdd();
      } else if (filteredTags.length === 1) {
        handleToggleTag(filteredTags[0].name);
        setSearch("");
      }
    }
    if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className={cn(
            "relative",
            tags.length > 0 && "text-primary"
          )}
        >
          <Tag className="h-4 w-4" />
          {tags.length > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-medium">
              {tags.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3 bg-popover border shadow-lg z-50" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Tags</h4>
            <span className="text-xs text-muted-foreground">{tags.length} selecionada(s)</span>
          </div>
          
          {/* Search/Create Input */}
          <div className="relative">
            <Input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar ou criar tag..."
              className="h-8 text-sm pr-8"
              maxLength={30}
            />
            {createTag.isPending && (
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Create new tag option */}
          {canCreateNew && (
            <button
              onClick={handleCreateAndAdd}
              disabled={createTag.isPending}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent text-left transition-colors"
            >
              <Plus className="h-4 w-4 text-primary" />
              <span>Criar tag "</span>
              <span className="font-medium text-primary">{search.trim().toLowerCase()}</span>
              <span>"</span>
            </button>
          )}
          
          {/* Existing tags list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredTags.length > 0 ? (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {filteredTags.map((tag) => {
                const isSelected = tags.includes(tag.name);
                return (
                  <button
                    key={tag.id}
                    onClick={() => handleToggleTag(tag.name)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md transition-colors text-left",
                      isSelected 
                        ? "bg-primary/10 text-primary" 
                        : "hover:bg-accent"
                    )}
                  >
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 truncate">{tag.name}</span>
                    {isSelected && (
                      <Check className="h-4 w-4 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : search.trim() === "" ? (
            <p className="text-xs text-muted-foreground text-center py-2">
              Nenhuma tag criada ainda
            </p>
          ) : null}

          {/* Selected tags */}
          {tags.length > 0 && (
            <div className="border-t pt-2">
              <p className="text-[10px] text-muted-foreground mb-1.5">Selecionadas:</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tagName) => {
                  const tagData = teamTags.find(t => t.name === tagName);
                  return (
                    <Badge
                      key={tagName}
                      variant="secondary"
                      className="pl-2 pr-1 py-0.5 gap-1 text-xs font-normal group"
                      style={tagData ? { 
                        backgroundColor: `${tagData.color}20`,
                        borderColor: tagData.color 
                      } : undefined}
                    >
                      <span className="truncate max-w-[100px]">{tagName}</span>
                      <button
                        onClick={() => handleToggleTag(tagName)}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 transition-colors"
                      >
                        <X className="h-3 w-3 text-muted-foreground group-hover:text-destructive" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Hint */}
          <p className="text-[10px] text-muted-foreground border-t pt-2">
            Pressione Enter para criar ou selecionar
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
