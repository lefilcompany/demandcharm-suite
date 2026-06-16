import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  // Safety timeout: if loading for too long (>8s), assume something is stuck and proceed.
  // The user will be redirected to /auth if there's still no session.
  const [forceContinue, setForceContinue] = useState(false);
  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => setForceContinue(true), 8000);
      return () => clearTimeout(t);
    }
    setForceContinue(false);
  }, [loading]);

  if (loading && !forceContinue) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sidebar">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}
