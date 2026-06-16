import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AssigneeAvatarsProps {
  assignees: {
    user_id: string;
    profile: {
      full_name: string;
      avatar_url: string | null;
    };
  }[];
  maxVisible?: number;
  size?: "sm" | "md" | "lg";
  clickable?: boolean;
}

const sizeClasses = {
  sm: "h-5 w-5 text-[10px]",
  md: "h-6 w-6 text-xs",
  lg: "h-8 w-8 text-sm",
};

export function AssigneeAvatars({ assignees, maxVisible = 3, size = "md", clickable = true }: AssigneeAvatarsProps) {
  const navigate = useNavigate();
  
  // Filter out any assignees with missing profile data
  const validAssignees = assignees?.filter(a => a?.profile) || [];
  if (validAssignees.length === 0) return null;

  const visible = validAssignees.slice(0, maxVisible);
  const remaining = validAssignees.length - maxVisible;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleAvatarClick = (e: React.MouseEvent, userId: string) => {
    if (!clickable || userId === "legacy") return;
    e.stopPropagation();
    navigate(`/user/${userId}`);
  };

  return (
    <div className="flex -space-x-2">
      {visible.map((assignee) => (
        <Tooltip key={assignee.user_id}>
          <TooltipTrigger asChild>
            <Avatar 
              className={`${sizeClasses[size]} ring-2 ring-background ${clickable && assignee.user_id !== "legacy" ? "cursor-pointer hover:ring-primary transition-all" : ""}`}
              onClick={(e) => handleAvatarClick(e, assignee.user_id)}
            >
              <AvatarImage src={assignee.profile.avatar_url || undefined} alt={assignee.profile.full_name} />
              <AvatarFallback className={sizeClasses[size]}>
                {getInitials(assignee.profile.full_name)}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>
            <p>{assignee.profile.full_name}</p>
          </TooltipContent>
        </Tooltip>
      ))}
      {remaining > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Avatar className={`${sizeClasses[size]} ring-2 ring-background bg-muted`}>
              <AvatarFallback className={`${sizeClasses[size]} bg-muted`}>
                +{remaining}
              </AvatarFallback>
            </Avatar>
          </TooltipTrigger>
          <TooltipContent>
            <p>{validAssignees.slice(maxVisible).map(a => a.profile.full_name).join(", ")}</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}