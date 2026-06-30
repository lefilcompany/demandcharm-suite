import { useEffect, useState, useRef } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Indeterminate orange progress bar shown at the top of the main panel
 * while routes are loading (Suspense) or React Query has active fetches.
 */
export function TopLoadingBar() {
  const isFetching = useIsFetching();
  const location = useLocation();
  const navType = useNavigationType();
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownAt = useRef<number>(0);
  const isFetchingRef = useRef(isFetching);
  isFetchingRef.current = isFetching;

  // Show on every route change for a brief progress flash
  useEffect(() => {
    setVisible(true);
    shownAt.current = Date.now();
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    const t = setTimeout(() => {
      if (isFetchingRef.current === 0) {
        setVisible(false);
        shownAt.current = 0;
      }
    }, 600);
    return () => clearTimeout(t);
  }, [location.pathname, navType]);

  // Track React Query activity
  useEffect(() => {
    if (isFetching > 0) {
      setVisible(true);
      if (!shownAt.current) shownAt.current = Date.now();
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    } else if (visible) {
      const elapsed = Date.now() - (shownAt.current || Date.now());
      const remaining = Math.max(0, 400 - elapsed);
      hideTimer.current = setTimeout(() => {
        setVisible(false);
        shownAt.current = 0;
      }, remaining + 150);
    }
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    };
  }, [isFetching, visible]);

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute left-0 right-0 top-0 z-50 h-[3px] overflow-hidden rounded-t-xl transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="h-full w-1/3 animate-top-loading-bar bg-primary shadow-[0_0_8px_rgba(242,135,5,0.6)]" />
    </div>
  );
}
