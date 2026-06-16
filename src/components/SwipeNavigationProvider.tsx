import { useSwipeGesture } from "@/hooks/useSwipeGesture";
import { useIsMobile } from "@/hooks/use-mobile";

interface SwipeNavigationProviderProps {
  children: React.ReactNode;
}

export const SwipeNavigationProvider = ({ children }: SwipeNavigationProviderProps) => {
  const isMobile = useIsMobile();
  
  // Only enable swipe gestures on mobile devices
  useSwipeGesture({
    enabled: isMobile,
    threshold: 80,
    edgeWidth: 30,
  });

  return <>{children}</>;
};
