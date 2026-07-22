import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { rememberLastEmail, rememberLastLoginMethod } from "@/lib/lastUserEmail";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Token refresh interval (5 minutes before expiry)
const TOKEN_REFRESH_MARGIN = 5 * 60 * 1000; // 5 minutes in ms

// Session duration without "remember me" (24 hours)
const SHORT_SESSION_DURATION = 24 * 60 * 60 * 1000;
// Session duration with "remember me" enabled (7 days)
const LONG_SESSION_DURATION = 7 * 24 * 60 * 60 * 1000;

// Clear per-user UI session state (e.g. Kanban filters) on logout / session expiry
const clearUserSessionState = () => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("kanban_filters:")) keysToRemove.push(key);
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore storage errors
  }
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const intentionalSignOutRef = useRef(false);

  // Function to schedule automatic token refresh
  const scheduleTokenRefresh = useCallback((currentSession: Session | null) => {
    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }

    if (!currentSession?.expires_at) return;

    // Calculate time until token expires (expires_at is in seconds)
    const expiresAt = currentSession.expires_at * 1000; // Convert to ms
    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;
    
    // Schedule refresh 5 minutes before expiry, or immediately if less than 5 minutes
    const refreshIn = Math.max(timeUntilExpiry - TOKEN_REFRESH_MARGIN, 0);

    if (refreshIn > 0 && refreshIn < 24 * 60 * 60 * 1000) { // Only schedule if within 24 hours
      console.log(`Token refresh scheduled in ${Math.round(refreshIn / 1000 / 60)} minutes`);
      
      refreshTimeoutRef.current = setTimeout(async () => {
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (error) {
            console.error("Auto token refresh failed:", error.message);
            const m = error.message || "";
            // If refresh token is invalid/expired, force a clean local sign-out
            // so the app doesn't keep making 401 requests. SIGNED_OUT will reset state.
            if (
              m.includes("Refresh Token") ||
              m.includes("refresh_token") ||
              m.includes("Invalid") ||
              m.includes("expired")
            ) {
              console.log("Refresh token invalid — clearing local session");
              await supabase.auth.signOut({ scope: "local" }).catch(() => {});
            }
          } else if (data.session) {
            console.log("Token refreshed successfully");
            // The onAuthStateChange (TOKEN_REFRESHED) listener will reschedule the next refresh
          }
        } catch (err) {
          console.error("Token refresh error:", err);
        }
      }, refreshIn);
    }
  }, []);

  // Manual refresh function exposed to context
  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        scheduleTokenRefresh(data.session);
      }
    } catch (error: any) {
      console.error("Manual session refresh failed:", error.message);
      throw error;
    }
  }, [scheduleTokenRefresh]);

  useEffect(() => {
    // Determine if session should be cleared based on remember me / time-based expiry
    const rememberMe = localStorage.getItem("rememberMe") === "true";
    const sessionExpiresAt = localStorage.getItem("sessionExpiresAt");
    const isSessionExpired = sessionExpiresAt && Date.now() > parseInt(sessionExpiresAt, 10);
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, currentSession: Session | null) => {
        console.log("Auth event:", event, currentSession ? "Session exists" : "No session");
        
        // Update state synchronously
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        // Handle different auth events
        switch (event) {
          case "SIGNED_IN":
          case "TOKEN_REFRESHED":
            // Schedule next automatic refresh
            scheduleTokenRefresh(currentSession);
            break;
          case "PASSWORD_RECOVERY":
            // User clicked on password recovery link - session is established
            // Do NOT redirect or logout - let them reset their password
            console.log("Password recovery event - user can now reset password");
            scheduleTokenRefresh(currentSession);
            break;
          case "SIGNED_OUT":
            // Clear refresh timeout
            if (refreshTimeoutRef.current) {
              clearTimeout(refreshTimeoutRef.current);
              refreshTimeoutRef.current = null;
            }
            break;
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession }, error }) => {
      // Handle error from getSession (e.g., invalid refresh token)
      if (error) {
        console.log("getSession error (likely stale token):", error.message);
        localStorage.removeItem("rememberMe");
        localStorage.removeItem("sessionExpiresAt");
        clearUserSessionState();
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }

      // If there's a session but the short session has expired, sign out locally
      const isPasswordResetPage = window.location.pathname === "/reset-password";
      
      if (existingSession && isSessionExpired && !isPasswordResetPage) {
        console.log("Session expired, signing out locally");
        localStorage.removeItem("sessionExpiresAt");
        clearUserSessionState();
        supabase.auth.signOut({ scope: 'local' }).then(() => {
          setSession(null);
          setUser(null);
          setLoading(false);
        });
        return;
      }
      
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      setLoading(false);
      
      // Schedule token refresh for existing session
      if (existingSession) {
        scheduleTokenRefresh(existingSession);
      }
    }).catch((err) => {
      // Catch any unexpected errors
      console.error("Unexpected getSession error:", err);
      setSession(null);
      setUser(null);
      setLoading(false);
    });

    // Cross-tab session synchronization
    const handleStorageChange = (e: StorageEvent) => {
      // Detect changes to Supabase auth keys in localStorage from other tabs
      if (e.key && e.key.startsWith('sb-') && e.key.endsWith('-auth-token')) {
        if (e.newValue === null) {
          // Another tab cleared the session (intentional global logout)
          setSession(null);
          setUser(null);
          navigate("/auth");
        } else {
          // Another tab signed in or refreshed - re-sync
          supabase.auth.getSession().then(({ data: { session: newSession } }) => {
            setSession(newSession);
            setUser(newSession?.user ?? null);
            if (newSession) {
              scheduleTokenRefresh(newSession);
            }
          });
        }
      }
    };

    // Refresh token when tab becomes visible again — covers cases where the tab
    // was inactive past expiry and the in-memory timer was throttled by the browser.
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession?.expires_at) return;
        const expiresAtMs = currentSession.expires_at * 1000;
        const msUntilExpiry = expiresAtMs - Date.now();
        // If token is already expired OR will expire within the refresh margin, refresh now
        if (msUntilExpiry < TOKEN_REFRESH_MARGIN) {
          const { data, error } = await supabase.auth.refreshSession();
          if (error) {
            const m = error.message || "";
            // Stale refresh_token — let SIGNED_OUT handle cleanup; don't toast
            if (m.includes("Refresh Token") || m.includes("refresh_token") || m.includes("Invalid")) {
              console.log("Refresh token invalid on visibility change, clearing session");
              await supabase.auth.signOut({ scope: "local" }).catch(() => {});
            }
          } else if (data.session) {
            scheduleTokenRefresh(data.session);
          }
        } else {
          // Reschedule timer in case the original timeout was paused while inactive
          scheduleTokenRefresh(currentSession);
        }
      } catch (err) {
        console.error("Visibility refresh error:", err);
      }
    };

    // Refresh on reconnect — network may have been down past expiry
    const handleOnline = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession?.expires_at) return;
        const msUntilExpiry = currentSession.expires_at * 1000 - Date.now();
        if (msUntilExpiry < TOKEN_REFRESH_MARGIN) {
          const { data, error } = await supabase.auth.refreshSession();
          if (!error && data.session) scheduleTokenRefresh(data.session);
        }
      } catch (err) {
        console.error("Online refresh error:", err);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    // Cleanup on unmount
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [scheduleTokenRefresh, navigate]);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;
      rememberLastEmail(email);
      // New signups never have a team yet — send them straight to /welcome to avoid
      // a flash of loading on / while RequireTeam decides where to send them.
      navigate("/welcome");
    } catch (error: any) {
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      rememberLastEmail(email);
      rememberLastLoginMethod("password");
      navigate("/");
    } catch (error: any) {
      throw error;
    }
  };

  const signOut = async () => {
    // Best-effort push cleanup for the current device — must run while the
    // session is still valid so RLS accepts the delete. Never block logout.
    try {
      const currentUserId = user?.id;
      if (currentUserId && typeof window !== "undefined") {
        const deviceId = window.localStorage.getItem("soma:fcm_device_id");
        if (deviceId) {
          await supabase
            .from("fcm_tokens")
            .delete()
            .eq("user_id", currentUserId)
            .eq("device_id", deviceId)
            .then(undefined, () => undefined);
        }
        try {
          const { deleteFcmToken } = await import("@/lib/firebase");
          await deleteFcmToken();
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.log("Push cleanup on signOut skipped:", (err as Error)?.message);
    }

    // Clear remember me preferences on logout
    localStorage.removeItem("rememberMe");
    localStorage.removeItem("sessionExpiresAt");

    // Clear per-user UI session state (e.g. Kanban filters)
    clearUserSessionState();

    // Clear local state first
    setSession(null);
    setUser(null);

    try {
      // Try to sign out from Supabase, but don't block on errors
      // (session might already be expired/missing)
      await supabase.auth.signOut();
    } catch (error: any) {
      // Ignore AuthSessionMissingError - session was already gone
      console.log("SignOut cleanup:", error?.name || error?.message);
    }

    toast.success("Logout realizado com sucesso!");
    navigate("/auth");
  };

  const resetPassword = async (email: string) => {
    try {
      // Determine the correct base URL for password reset
      const hostname = window.location.hostname;
      let baseUrl: string;
      
      if (hostname === 'pla.soma.lefil.com.br') {
        // Production domain
        baseUrl = 'https://pla.soma.lefil.com.br';
      } else if (hostname.includes('id-preview--') && hostname.includes('lovable.app')) {
        // Correct Lovable preview URL
        baseUrl = window.location.origin;
      } else if (hostname.includes('lovable.app') && !hostname.includes('id-preview--')) {
        // Lovable URL without id-preview prefix - add it
        const projectId = '74839b7a-ef2a-44d4-8ac6-301dbb814ccc';
        baseUrl = `https://id-preview--${projectId}.lovable.app`;
      } else {
        // Local development or other environments
        baseUrl = window.location.origin;
      }
      
      const redirectUrl = `${baseUrl}/reset-password`;
      console.log('Password reset redirect URL:', redirectUrl);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;
    } catch (error: any) {
      throw error;
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
    } catch (error: any) {
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signUp, signIn, signOut, resetPassword, updatePassword, refreshSession }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};