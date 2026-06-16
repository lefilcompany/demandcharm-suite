import { useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";

interface SwipeConfig {
  threshold?: number;
  edgeWidth?: number;
  enabled?: boolean;
}

export const useSwipeGesture = (config: SwipeConfig = {}) => {
  const { threshold = 80, edgeWidth = 30, enabled = true } = config;
  const navigate = useNavigate();
  const location = useLocation();
  
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);
  const isEdgeSwipe = useRef<boolean>(false);

  // Pages where back swipe should be disabled
  const noBackPages = ["/", "/auth", "/welcome"];

  const canGoBack = useCallback(() => {
    return !noBackPages.includes(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      touchStartX.current = touch.clientX;
      touchStartY.current = touch.clientY;
      touchCurrentX.current = touch.clientX;
      
      // Check if swipe started from the left edge
      isEdgeSwipe.current = touch.clientX <= edgeWidth;
      isSwiping.current = isEdgeSwipe.current && canGoBack();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isSwiping.current) return;

      const touch = e.touches[0];
      touchCurrentX.current = touch.clientX;
      
      const deltaX = touchCurrentX.current - touchStartX.current;
      const deltaY = Math.abs(touch.clientY - touchStartY.current);

      // Cancel if vertical movement is greater (user is scrolling)
      if (deltaY > Math.abs(deltaX)) {
        isSwiping.current = false;
        return;
      }

      // Only prevent default for horizontal swipes from edge
      if (deltaX > 10 && isEdgeSwipe.current) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      if (!isSwiping.current) return;

      const deltaX = touchCurrentX.current - touchStartX.current;

      if (deltaX > threshold && isEdgeSwipe.current && canGoBack()) {
        navigate(-1);
      }

      // Reset
      isSwiping.current = false;
      isEdgeSwipe.current = false;
      touchStartX.current = 0;
      touchStartY.current = 0;
      touchCurrentX.current = 0;
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [enabled, threshold, edgeWidth, navigate, canGoBack]);

  return { canGoBack: canGoBack() };
};
