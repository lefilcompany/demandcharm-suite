import { useEffect, useCallback, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const WARNING_DISABLED_KEY = "draft-exit-warning-disabled";

interface UseNavigationBlockOptions {
  shouldBlock: boolean;
}

export function useNavigationBlock({ shouldBlock }: UseNavigationBlockOptions) {
  const [showDialog, setShowDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const navigate = useNavigate();
  
  const [isWarningDisabled, setIsWarningDisabled] = useState(() => {
    try {
      return localStorage.getItem(WARNING_DISABLED_KEY) === "true";
    } catch {
      return false;
    }
  });

  // Handle browser's beforeunload for external navigation/tab close
  useEffect(() => {
    if (!shouldBlock) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [shouldBlock]);

  // Function to attempt navigation - shows dialog if blocking
  const attemptNavigation = useCallback((to: string | number) => {
    if (shouldBlock && !isWarningDisabled) {
      setPendingNavigation(typeof to === "number" ? "__back__" : to);
      setShowDialog(true);
      return false;
    }
    // Navigate immediately if not blocking or warning disabled
    if (typeof to === "number") {
      navigate(to);
    } else {
      navigate(to);
    }
    return true;
  }, [shouldBlock, isWarningDisabled, navigate]);

  const confirmNavigation = useCallback(() => {
    setShowDialog(false);
    if (pendingNavigation === "__back__") {
      navigate(-1);
    } else if (pendingNavigation) {
      navigate(pendingNavigation);
    }
    setPendingNavigation(null);
  }, [pendingNavigation, navigate]);

  const cancelNavigation = useCallback(() => {
    setShowDialog(false);
    setPendingNavigation(null);
  }, []);

  const setDontShowAgain = useCallback((value: boolean) => {
    try {
      if (value) {
        localStorage.setItem(WARNING_DISABLED_KEY, "true");
      } else {
        localStorage.removeItem(WARNING_DISABLED_KEY);
      }
      setIsWarningDisabled(value);
    } catch (error) {
      console.error("Error saving warning preference:", error);
    }
  }, []);

  return {
    isBlocked: showDialog,
    isWarningDisabled,
    attemptNavigation,
    confirmNavigation,
    cancelNavigation,
    setDontShowAgain,
  };
}
