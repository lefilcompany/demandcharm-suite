import { Badge } from "@/components/ui/badge";
import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

interface PositionBadgeProps {
  name: string;
  color: string;
  textColor?: string;
  className?: string;
  showIcon?: boolean;
  size?: "sm" | "md";
}

// Helper to determine if a color is light or dark
function isLightColor(hexColor: string): boolean {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  // Using relative luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

function getTextColor(bgColor: string, textColorPref?: string): string {
  if (textColorPref === "light") return "#FFFFFF";
  if (textColorPref === "dark") return "#1F2937";
  // auto - determine based on background
  return isLightColor(bgColor) ? "#1F2937" : "#FFFFFF";
}

const sizeClasses = {
  sm: "text-[10px] px-1.5 py-0 h-4",
  md: "text-xs px-2 py-0.5",
};

const iconSizeClasses = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
};

export function PositionBadge({ name, color, textColor: textColorPref, className, showIcon = true, size = "md" }: PositionBadgeProps) {
  const textColor = getTextColor(color, textColorPref);

  return (
    <Badge
      className={cn("flex items-center gap-1 justify-center border-0", sizeClasses[size], className)}
      style={{ backgroundColor: color, color: textColor }}
    >
      {showIcon && <Briefcase className={iconSizeClasses[size]} />}
      {name}
    </Badge>
  );
}
