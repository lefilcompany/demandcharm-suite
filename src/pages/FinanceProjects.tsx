import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useFinanceAccess } from "@/hooks/useFinance";
import { OpsLabel } from "@/components/ops/OpsParts";
import { MonthRangeField } from "@/components/ops/MonthRangeField";
import { TeamProjectsFinance } from "@/components/finance/TeamProjectsFinance";
import { Button } from "@/components/ui/button";

const MONTH = /^\d{4}-\d{2}$/;

export default function FinanceProjects() {
  const { selectedTeamId, currentTeam } = useSelectedTeam();
  const fin = useFinanceAccess(selectedTeamId);
  const [params, setParams] = useSearchParams();
  const now = new Date();
  const defFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().substring(0, 7);
  const [from, setFrom] = useState(MONTH.test(params.get("de") ?? "") ? params.get("de")! : defFrom);
  const [to, setTo] = useState(MONTH.test(params.get("ate") ?? "") ? params.get("ate")! : now.toISOString().substring(0, 7));

  if (!fin.isLoading && !fin.hasModule)
    return <p className="p-6 text-sm text-muted-foreground">Você não tem acesso à gestão financeira desta equipe.</p>;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Voltar"><Link to="/app/finance?aba=byProject"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="min-w-0">
            <OpsLabel>{currentTeam?.name ?? "Equipe"}</OpsLabel>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Todos os projetos</h1>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-1.5">
          <MonthRangeField from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setParams({ de: f, ate: t }, { replace: true }); }} />
        </div>
      </header>
      <TeamProjectsFinance teamId={selectedTeamId} from={from} to={to} />
    </div>
  );
}
