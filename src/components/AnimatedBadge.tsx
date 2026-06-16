import { useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge as GamificationBadge } from "@/hooks/useUserStats";

interface AnimatedBadgeProps {
  badge: GamificationBadge;
  isEarned: boolean;
  index: number;
}

export function AnimatedBadge({ badge, isEarned, index }: AnimatedBadgeProps) {
  const [hasAnimated, setHasAnimated] = useState(false);
  const [showUnlockEffect, setShowUnlockEffect] = useState(false);

  // Check localStorage to see if this badge was already shown as unlocked
  useEffect(() => {
    if (isEarned) {
      const unlockedBadges = JSON.parse(localStorage.getItem("unlocked-badges") || "[]");
      if (!unlockedBadges.includes(badge.id)) {
        // New unlock - show animation
        setShowUnlockEffect(true);
        // Save to localStorage
        localStorage.setItem("unlocked-badges", JSON.stringify([...unlockedBadges, badge.id]));
        // Remove effect after animation
        const timer = setTimeout(() => {
          setShowUnlockEffect(false);
        }, 2500);
        return () => clearTimeout(timer);
      }
    }
    setHasAnimated(true);
  }, [isEarned, badge.id]);

  // Staggered animation delay based on index
  const animationDelay = `${index * 50}ms`;

  if (isEarned) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`
              relative flex flex-col items-center p-4 rounded-xl border-2 
              transition-all hover:scale-105 cursor-pointer
              ${showUnlockEffect ? 'animate-badge-unlock' : 'animate-fade-in'}
            `}
            style={{ 
              borderColor: badge.color,
              backgroundColor: `${badge.color}15`,
              animationDelay: showUnlockEffect ? '0ms' : animationDelay,
              // @ts-ignore - CSS variable for pulse animation
              '--badge-color': `${badge.color}50`,
            } as React.CSSProperties}
          >
            {/* Unlock glow effect */}
            {showUnlockEffect && (
              <>
                {/* Outer glow ring */}
                <div 
                  className="absolute inset-0 rounded-xl animate-badge-pulse"
                  style={{ 
                    // @ts-ignore
                    '--badge-color': `${badge.color}60`,
                  } as React.CSSProperties}
                />
                {/* Shine effect */}
                <div 
                  className="absolute inset-0 rounded-xl overflow-hidden"
                >
                  <div 
                    className="absolute inset-0 animate-badge-shine"
                    style={{
                      background: `linear-gradient(90deg, transparent 0%, ${badge.color}40 50%, transparent 100%)`,
                      backgroundSize: '200% 100%',
                    }}
                  />
                </div>
                {/* Sparkle particles */}
                <div className="absolute -top-1 -right-1 text-lg animate-bounce">✨</div>
                <div className="absolute -bottom-1 -left-1 text-lg animate-bounce" style={{ animationDelay: '150ms' }}>✨</div>
              </>
            )}
            
            <span className={`text-3xl mb-2 ${showUnlockEffect ? 'animate-bounce' : ''}`}>
              {badge.icon}
            </span>
            <span className="text-xs font-medium text-center line-clamp-2 relative z-10">
              {badge.name}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="font-medium">{badge.name}</p>
          <p className="text-xs text-muted-foreground">{badge.description}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Locked badge
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div 
          className="flex flex-col items-center p-4 rounded-xl border-2 border-muted bg-muted/30 opacity-50 cursor-pointer animate-fade-in"
          style={{ animationDelay }}
        >
          <span className="text-3xl mb-2 grayscale">{badge.icon}</span>
          <span className="text-xs font-medium text-center text-muted-foreground">???</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">🔒 Bloqueado</p>
        <p className="text-xs text-muted-foreground">{badge.description}</p>
      </TooltipContent>
    </Tooltip>
  );
}