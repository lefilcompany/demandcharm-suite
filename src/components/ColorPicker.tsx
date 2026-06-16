import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

const PRESET_COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#14B8A6", // teal
  "#3B82F6", // blue
  "#6366F1", // indigo
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#6B7280", // gray
  "#1F2937", // dark gray
  "#78716C", // stone
];

export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
  const [customColor, setCustomColor] = useState(value);

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setCustomColor(newColor);
    if (/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
      onChange(newColor);
    }
  };

  const handlePresetClick = (color: string) => {
    onChange(color);
    setCustomColor(color);
  };

  return (
    <div className="space-y-3">
      {label && <Label>{label}</Label>}
      
      {/* Preset Colors */}
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => handlePresetClick(color)}
            className={cn(
              "h-8 w-8 rounded-full border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2",
              value.toUpperCase() === color.toUpperCase()
                ? "border-foreground ring-2 ring-offset-2 ring-foreground scale-110"
                : "border-transparent"
            )}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* Custom Color Input */}
      <div className="flex items-center gap-2">
        <div
          className="h-8 w-8 rounded-full border-2 border-muted shrink-0"
          style={{ backgroundColor: value }}
        />
        <Input
          type="text"
          value={customColor}
          onChange={handleCustomColorChange}
          placeholder="#HEX"
          className="font-mono uppercase"
          maxLength={7}
        />
        <input
          type="color"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setCustomColor(e.target.value);
          }}
          className="h-8 w-8 cursor-pointer rounded border-0 p-0"
          title="Escolher cor"
        />
      </div>
    </div>
  );
}
