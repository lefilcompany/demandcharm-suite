import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Check, Copy, KeyRound } from "lucide-react";
import { useTeamJoinRequests } from "@/hooks/useTeamJoinRequests";

interface TeamJoinRequestsCardProps {
  teamId: string;
  accessCode?: string | null;
}

const MAX_PREVIEW = 3;

function initials(name?: string | null) {
  return (name?.trim().charAt(0) || "?").toUpperCase();
}

export function TeamJoinRequestsCard({ teamId, accessCode }: TeamJoinRequestsCardProps) {
  const navigate = useNavigate();
  const { data: requests, isLoading } = useTeamJoinRequests(teamId);
  const [copied, setCopied] = useState(false);

  const pending = requests ?? [];
  const count = pending.length;
  const shown = pending.slice(0, MAX_PREVIEW);
  const hidden = count - shown.length;

  const handleCopyCode = () => {
    if (!accessCode) return;
    navigator.clipboard.writeText(accessCode);
    setCopied(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const openRequests = () => navigate(`/app/teams/${teamId}/requests`);

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex min-w-0 items-center gap-2">
            <KeyRound className="h-5 w-5 shrink-0" />
            Acesso à equipe
          </CardTitle>
          {count > 0 && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
              <span
                className="h-1.5 w-1.5 rounded-full bg-primary motion-safe:animate-pulse motion-reduce:animate-none"
                aria-hidden="true"
              />
              {count} {count === 1 ? "aguardando" : "aguardando"}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : count > 0 ? (
          <ul className="divide-y divide-border/60">
            {shown.map((request) => (
              <li key={request.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={request.profiles?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">
                    {initials(request.profiles?.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {request.profiles?.full_name || "Usuário"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {request.profiles?.email || "Sem e-mail informado"}
                  </p>
                </div>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {formatDistanceToNow(new Date(request.requested_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="pt-4">
          {hidden > 0 && (
            <p className="mb-2 text-xs text-muted-foreground tabular-nums">
              +{hidden} {hidden === 1 ? "pessoa" : "pessoas"} na fila
            </p>
          )}

          {accessCode && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-dashed border-border/70 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Código de acesso
                </p>
                <p className="truncate font-mono text-sm">{accessCode}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={handleCopyCode}
                aria-label="Copiar código de acesso"
                title="Copiar código de acesso"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          )}

          <Button
            variant={count > 0 ? "default" : "outline"}
            size="sm"
            className="w-full gap-1.5 px-3 py-1.5 text-sm"
            onClick={openRequests}
          >
            Ver solicitações
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
