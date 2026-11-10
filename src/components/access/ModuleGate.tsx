import { Loader2, Lock } from "lucide-react";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { canUseModule, type ModulePermission } from "@/lib/access/profiles";

export function ModuleGate({ perm, children }: { perm: ModulePermission; children: React.ReactNode }) {
  const access = useModuleAccess();
  if (access.isLoading) return <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (access.isError) return <div className="p-10 text-sm text-center">Não foi possível verificar seu acesso. <button className="underline text-primary" onClick={() => access.refetch()}>Tentar de novo</button></div>;
  if (!canUseModule(access.data, perm)) return (
    <div className="p-10 flex flex-col items-center text-center gap-2">
      <Lock className="h-6 w-6 text-muted-foreground" />
      <p className="font-medium">Você não tem acesso a esta área.</p>
      <p className="text-sm text-muted-foreground">Peça ao dono da equipe.</p>
    </div>
  );
  return <>{children}</>;
}
