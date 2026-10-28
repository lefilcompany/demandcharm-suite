import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { rememberLastEmail, rememberLastLoginMethod, rememberAccount } from "@/lib/lastUserEmail";

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

// Saved session lifetime in the browser (24 hours, absolute from sign-in)
const SESSION_DURATION = 24 * 60 * 60 * 1000;

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

  // Token refresh is left entirely to supabase-js (autoRefreshToken), which has an
  // internal lock against concurrent refreshes. Manual timers/visibility handlers
  // used to race it — and the Lovable preview broker keeps a second copy of the
  // session in the editor — so two refreshes fired with the same single-use refresh
  // token, the backend revoked the whole session and every request turned 401.

  // Manual refresh function exposed to context
  const refreshSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
      }
    } catch (error: any) {
      console.error("Manual session refresh failed:", error.message);
      throw error;
    }
  }, []);

  useEffect(() => {
    // Determine if session should be cleared based on time-based expiry (30 days)
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
            // Absolute 24h session: set only at sign-in, never extended by refreshes
            try {
              if (event === "SIGNED_IN" || !localStorage.getItem("sessionExpiresAt")) {
                localStorage.setItem("sessionExpiresAt", (Date.now() + SESSION_DURATION).toString());
              }
            } catch {
              // ignore
            }
            if (currentSession?.user?.email) {
              const meta = (currentSession.user.user_metadata ?? {}) as Record<string, unknown>;
              rememberAccount({
                email: currentSession.user.email,
                name: (meta.full_name as string) || (meta.name as string) || undefined,
                avatarUrl: (meta.avatar_url as string) || undefined,
                method: currentSession.user.app_metadata?.provider === "google" ? "google" : "password",
              });
            }
            break;
          case "PASSWORD_RECOVERY":
            // User clicked on password recovery link - session is established
            // Do NOT redirect or logout - let them reset their password
            console.log("Password recovery event - user can now reset password");
            break;
          case "SIGNED_OUT":
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
          });
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Cleanup on unmount
    return () => {
      subscription.unsubscribe();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [navigate]);

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
      navigate("/app/welcome");
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
      navigate("/app");
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