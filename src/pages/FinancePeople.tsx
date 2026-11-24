import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useFinanceAccess, useFinancePeople } from "@/hooks/useFinance";
import { OpsLabel } from "@/components/ops/OpsParts";
import { MonthRangeField } from "@/components/ops/MonthRangeField";
import { CostsProductivity } from "@/components/finance/CostsProductivity";
import { Button } from "@/components/ui/button";

const MONTH = /^\d{4}-\d{2}$/;

export default function FinancePeople() {
  const { selectedTeamId, currentTeam } = useSelectedTeam();
  const fin = useFinanceAccess(selectedTeamId);
  const [params, setParams] = useSearchParams();
  const now = new Date();
  const defFrom = `${now.getFullYear()}-01`;
  const defTo = `${now.getFullYear()}-12`;
  const [from, setFrom] = useState(MONTH.test(params.get("de") ?? "") ? params.get("de")! : defFrom);
  const [to, setTo] = useState(MONTH.test(params.get("ate") ?? "") ? params.get("ate")! : defTo);

  const lastDay = new Date(Number(to.substring(0, 4)), Number(to.substring(5, 7)), 0).getDate();
  const people = useFinancePeople(selectedTeamId, `${from}-01`, `${to}-${String(lastDay).padStart(2, "0")}`, fin.hasModule && from <= to);
  const boardOrder = [...new Set((people.data ?? []).map((r) => r.board_id).filter(Boolean) as string[])];

  if (!fin.isLoading && !fin.hasModule)
    return <p className="p-6 text-sm text-muted-foreground">Você não tem acesso à gestão financeira desta equipe.</p>;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button asChild variant="ghost" size="icon" aria-label="Voltar"><Link to="/app/finance?aba=people"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <div className="min-w-0">
            <OpsLabel>{currentTeam?.name ?? "Equipe"}</OpsLabel>
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">Todas as pessoas</h1>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-1.5">
          <MonthRangeField from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); setParams({ de: f, ate: t }, { replace: true }); }} />
        </div>
      </header>
      <CostsProductivity rows={people.data ?? []} detailed={fin.can("finance.view_employee_costs")} isLoading={people.isLoading} isError={people.isError} onRetry={() => people.refetch()} boardOrder={boardOrder} teamId={selectedTeamId} canEdit={fin.can("finance.manage_settings")} />
    </div>
  );
}
