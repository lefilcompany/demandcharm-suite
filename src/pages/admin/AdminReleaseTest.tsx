import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Rocket, Mail, Bell, Users } from "lucide-react";

interface Counts {
  pending: number;
  processing: number;
  sent: number;
  skipped: number;
  failed: number;
  total: number;
}

interface FeatureReport {
  id: string;
  announcementKey: string;
  title: string;
  priority: string;
  audienceScope: string;
  emailEnabled: boolean;
  inappEnabled: boolean;
  status: string;
  audienceSize: number;
  email: Counts;
  inapp: Counts;
}

interface TestResult {
  success: boolean;
  duplicate: boolean;
  release: { id: string; release_key: string; status: string };
  eventId: string | null;
  features: FeatureReport[];
  totals: { audience: number; email: Counts; inapp: Counts };
}

const NONE = "none";

function CountsGrid({ counts }: { counts: Counts }) {
  const items: Array<[string, number, string]> = [
    ["Pendentes", counts.pending + counts.processing, "text-muted-foreground"],
    ["Enviados", counts.sent, "text-emerald-500"],
    ["Ignorados", counts.skipped, "text-amber-500"],
    ["Falhas", counts.failed, "text-destructive"],
  ];
  return (
    <div className="grid grid-cols-4 gap-2">
      {items.map(([label, value, className]) => (
        <div key={label} className="rounded-lg border bg-muted/30 p-3 text-center">
          <p className={`text-xl font-semibold ${className}`}>{value}</p>
          <p className="text-[11px] text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
}

export default function AdminReleaseTest() {
  const [teams, setTeams] = useState<Array<{ id: string; name: string }>>([]);
  const [boards, setBoards] = useState<Array<{ id: string; name: string; team_id: string }>>([]);
  const [teamId, setTeamId] = useState<string>(NONE);
  const [boardId, setBoardId] = useState<string>(NONE);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: teamRows }, { data: boardRows }] = await Promise.all([
        supabase.from("teams").select("id, name").order("name").limit(200),
        supabase.from("boards").select("id, name, team_id").order("name").limit(500),
      ]);
      setTeams(teamRows ?? []);
      setBoards(boardRows ?? []);
    })();
  }, []);

  const filteredBoards = useMemo(
    () => (teamId === NONE ? boards : boards.filter((b) => b.team_id === teamId)),
    [boards, teamId],
  );

  const runTest = async () => {
    setRunning(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("test-release-event", {
        body: {
          teamId: teamId === NONE ? null : teamId,
          boardId: boardId === NONE ? null : boardId,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      setResult(data as TestResult);
      toast.success("Release simulada publicada pelo pipeline real.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao simular a release");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Teste de Release</h1>
        <p className="text-sm text-muted-foreground">
          Dispara uma release simulada pelo mesmo pipeline de produção (ingest → evento → audiência →
          entregas). Uso exclusivo de QA.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parâmetros do teste</CardTitle>
          <CardDescription>
            A equipe define a audiência da feature de equipe. O quadro, quando informado, é usado como
            escopo da feature de melhoria geral.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Equipe (opcional)</Label>
              <Select
                value={teamId}
                onValueChange={(value) => {
                  setTeamId(value);
                  setBoardId(NONE);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhuma</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Quadro (opcional)</Label>
              <Select value={boardId} onValueChange={setBoardId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Nenhum</SelectItem>
                  {filteredBoards.map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={runTest} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
            Simular publicação
          </Button>
        </CardContent>
      </Card>

      {result && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Release</CardTitle>
              <CardDescription>
                {result.release.release_key} · evento {result.eventId ?? "—"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">status: {result.release.status}</Badge>
                <Badge variant="outline" className="gap-1">
                  <Users className="h-3 w-3" /> audiência resolvida: {result.totals.audience}
                </Badge>
                {result.duplicate && <Badge variant="destructive">duplicada (ignorada)</Badge>}
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Mail className="h-4 w-4" /> E-mails
                  </p>
                  <CountsGrid counts={result.totals.email} />
                </div>
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Bell className="h-4 w-4" /> In-app
                  </p>
                  <CountsGrid counts={result.totals.inapp} />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {result.features.map((feature) => (
              <Card key={feature.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-sm">{feature.title}</CardTitle>
                    <Badge variant="outline">{feature.priority}</Badge>
                    <Badge variant="outline">escopo: {feature.audienceScope}</Badge>
                    <Badge variant="secondary">{feature.status}</Badge>
                  </div>
                  <CardDescription>
                    {feature.announcementKey} · audiência: {feature.audienceSize} usuário(s)
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      E-mail {feature.emailEnabled ? "" : "(desativado na feature)"}
                    </p>
                    <CountsGrid counts={feature.email} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      In-app {feature.inappEnabled ? "" : "(desativado na feature)"}
                    </p>
                    <CountsGrid counts={feature.inapp} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
