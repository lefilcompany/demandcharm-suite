import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useDemandPresence } from "@/hooks/useDemandPresence";
import { Eye } from "lucide-react";

interface DemandPresenceIndicatorProps {
  demandId: string;
}

export function DemandPresenceIndicator({ demandId }: DemandPresenceIndicatorProps) {
  const { presenceUsers, isConnected } = useDemandPresence(demandId);

  if (!isConnected || presenceUsers.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2 animate-fade-in">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          <span>Visualizando agora:</span>
        </div>
        <div className="flex -space-x-2">
          {presenceUsers.slice(0, 5).map((user) => (
            <Tooltip key={user.id}>
              <TooltipTrigger asChild>
                <Avatar className="h-7 w-7 border-2 border-background ring-2 ring-primary/20 animate-pulse-subtle">
                  <AvatarImage src={user.avatar_url || undefined} alt={user.full_name} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {user.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-medium">{user.full_name}</p>
                <p className="text-muted-foreground">Visualizando agora</p>
              </TooltipContent>
            </Tooltip>
          ))}
          {presenceUsers.length > 5 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Avatar className="h-7 w-7 border-2 border-background">
                  <AvatarFallback className="text-xs bg-muted">
                    +{presenceUsers.length - 5}
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p>E mais {presenceUsers.length - 5} pessoa(s)</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
