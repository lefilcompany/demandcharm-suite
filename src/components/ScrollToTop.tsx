import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    // Also reset internal scrollable containers used by layouts
    document.querySelectorAll(".flex-1.overflow-y-auto").forEach((el) => {
      el.scrollTop = 0;
    });
  }, [pathname]);

  return null;
}
