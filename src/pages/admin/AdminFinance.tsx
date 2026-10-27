import { useState } from "react";
import { useAdminTeams } from "@/hooks/admin/useAdminTeams";
import Finance from "@/pages/Finance";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminFinance() {
  const { data: teams = [] } = useAdminTeams();
  const [teamId, setTeamId] = useState<string | null>(null);
  const team = (teams as any[]).find((t) => t.id === teamId);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-3 pt-3 sm:px-4 md:px-6">
        <span className="text-sm text-muted-foreground">Equipe</span>
        <Select value={teamId ?? ""} onValueChange={setTeamId}>
          <SelectTrigger className="h-9 w-[280px]"><SelectValue placeholder="Escolha uma equipe" /></SelectTrigger>
          <SelectContent>
            {(teams as any[]).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {teamId ? <Finance key={teamId} teamId={teamId} teamName={team?.name} />
        : <p className="px-6 py-10 text-sm text-muted-foreground">Escolha uma equipe para ver e configurar a Inteligência Financeira.</p>}
    </div>
  );
}
