import { useState } from "react";
import { Eye, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getImpersonation, stopImpersonation } from "@/lib/impersonation";

export function ImpersonationBanner() {
  const [state] = useState(getImpersonation);
  const [leaving, setLeaving] = useState(false);
  if (!state) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 flex items-center gap-3 rounded-full border border-primary bg-secondary px-4 py-2 text-secondary-foreground shadow-xl">
      <Eye className="h-4 w-4 text-primary shrink-0" />
      <span className="text-sm">
        Você está na conta de <strong>{state.targetName || state.targetEmail}</strong>
      </span>
      <Button
        size="sm"
        className="h-7 rounded-full"
        disabled={leaving}
        onClick={async () => { setLeaving(true); await stopImpersonation(); }}
      >
        {leaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5 mr-1" />}
        Voltar ao admin
      </Button>
    </div>
  );
}
