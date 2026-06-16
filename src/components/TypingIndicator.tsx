import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface TypingUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface TypingIndicatorProps {
  users: TypingUser[];
  className?: string;
}

export function TypingIndicator({ users, className }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const getTypingText = () => {
    if (users.length === 1) {
      return `${users[0].name} está digitando`;
    } else if (users.length === 2) {
      return `${users[0].name} e ${users[1].name} estão digitando`;
    } else {
      return `${users[0].name} e mais ${users.length - 1} estão digitando`;
    }
  };

  return (
    <div 
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground animate-fade-in",
        className
      )}
    >
      <div className="flex -space-x-2">
        {users.slice(0, 3).map((user) => (
          <Avatar key={user.id} className="h-5 w-5 border-2 border-background">
            <AvatarImage src={user.avatarUrl || undefined} alt={user.name} />
            <AvatarFallback className="text-[8px] bg-primary/10 text-primary">
              {user.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      
      <span className="flex items-center gap-1">
        {getTypingText()}
        <span className="flex gap-0.5">
          <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </span>
      </span>
    </div>
  );
}
