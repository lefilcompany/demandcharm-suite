import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface UserProfileLinkProps {
  userId: string;
  fullName: string;
  avatarUrl?: string | null;
  showAvatar?: boolean;
  avatarSize?: "sm" | "md" | "lg";
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

const sizeClasses = {
  sm: "h-5 w-5 text-[10px]",
  md: "h-6 w-6 text-xs",
  lg: "h-8 w-8 text-sm",
};

export function UserProfileLink({
  userId,
  fullName,
  avatarUrl,
  showAvatar = false,
  avatarSize = "md",
  className,
  onClick,
}: UserProfileLinkProps) {
  const navigate = useNavigate();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick(e);
    }
    navigate(`/user/${userId}`);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 hover:underline text-foreground font-medium cursor-pointer transition-colors hover:text-primary",
        className
      )}
    >
      {showAvatar && (
        <Avatar className={cn(sizeClasses[avatarSize], "ring-2 ring-background")}>
          <AvatarImage src={avatarUrl || undefined} alt={fullName} />
          <AvatarFallback className={sizeClasses[avatarSize]}>
            {getInitials(fullName)}
          </AvatarFallback>
        </Avatar>
      )}
      <span>{fullName}</span>
    </button>
  );
}
