import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { usePresence } from "@/contexts/PresenceContext";

interface AvatarWithStatusProps {
  userId?: string;
  src?: string;
  fallback?: string;
  className?: string;
  showStatus?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
};

const statusSizeClasses = {
  sm: "h-2.5 w-2.5 border",
  md: "h-3 w-3 border-2",
  lg: "h-3.5 w-3.5 border-2",
  xl: "h-4 w-4 border-2",
};

export function AvatarWithStatus({
  userId,
  src,
  fallback = "?",
  className,
  showStatus = true,
  size = "md",
}: AvatarWithStatusProps) {
  const { isUserOnline } = usePresence();
  const isOnline = userId ? isUserOnline(userId) : false;

  return (
    <div className="relative inline-block">
      <Avatar className={cn(sizeClasses[size], className)}>
        <AvatarImage src={src} />
        <AvatarFallback>{fallback}</AvatarFallback>
      </Avatar>
      {showStatus && userId && (
        <span
          className={cn(
            "absolute bottom-0 right-0 rounded-full border-background",
            statusSizeClasses[size],
            isOnline 
              ? "bg-success animate-pulse" 
              : "bg-muted-foreground/50"
          )}
          title={isOnline ? "Online" : "Offline"}
        />
      )}
    </div>
  );
}
