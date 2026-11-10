import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { canUseModule } from "@/lib/access/profiles";

/** Home page: without reports access, go straight to the Kanban. */
export function DashboardGate({ children }: { children: React.ReactNode }) {
  const access = useModuleAccess();
  if (access.isLoading) return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (access.data && !canUseModule(access.data, "reports.view")) return <Navigate to="/app/kanban" replace />;
  return <>{children}</>;
}
