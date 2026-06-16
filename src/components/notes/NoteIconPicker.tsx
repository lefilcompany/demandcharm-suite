import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

const EMOJI_CATEGORIES = {
  "Recentes": ["📝", "📄", "📋", "📌", "📎", "✏️", "🔖", "📚"],
  "Trabalho": ["💼", "📊", "📈", "💡", "🎯", "⚡", "🔧", "🛠️"],
  "Status": ["✅", "❌", "⚠️", "🔴", "🟡", "🟢", "🔵", "⭐"],
  "Objetos": ["📁", "🗂️", "📂", "🗃️", "📦", "🎁", "💎", "🔑"],
  "Natureza": ["🌱", "🌿", "🍀", "🌸", "🌺", "🌻", "🌲", "🌴"],
  "Símbolos": ["❤️", "💙", "💚", "💛", "💜", "🖤", "🤍", "💯"],
};

interface NoteIconPickerProps {
  value: string;
  onChange: (icon: string) => void;
}

export function NoteIconPicker({ value, onChange }: NoteIconPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          className="h-16 w-16 text-4xl hover:bg-muted rounded-xl transition-colors"
        >
          {value}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="space-y-3">
          {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
            <div key={category}>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {category}
              </p>
              <div className="flex flex-wrap gap-1">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      onChange(emoji);
                      setOpen(false);
                    }}
                    className="w-8 h-8 flex items-center justify-center text-lg hover:bg-muted rounded transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
