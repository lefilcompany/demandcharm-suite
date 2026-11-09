import { MonthField } from "@/components/ops/MonthField";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle } from "lucide-react";
import { fmtHours } from "@/lib/finance/timeSlices";

type Gap = { user_id: string; name: string; hours: number; missing_kind: boolean; missing_cost: boolean };

/** Lists people with hours in the month but without link or hourly cost, so cost is never silently zero. */
export function PeopleGapsAlert({ teamId, onFixCost, onFixKind }: { teamId: string; onFixCost: (userId: string, month: string) => void; onFixKind: (userId: string) => void }) {
  const { user } = useAuth();
  const [month, setMonth] = useState(new Date().toISOString().substring(0, 7));
  const q = useQuery({
    queryKey: ["finance-people-gaps", teamId, month, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("finance_people_gaps", { _team_id: teamId, _competence: `${month}-01` });
      if (error) throw error;
      return data as Gap[];
    },
  });
  if (q.isError || !q.data) return null;

  return (
    <section aria-label="Pendências de cadastro" className={`rounded-xl border p-4 space-y-3 xl:col-span-2 ${q.data.length ? "border-primary/50 bg-primary/5" : "bg-card"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className={`h-4 w-4 ${q.data.length ? "text-primary" : "text-muted-foreground"}`} />
        <h3 className="font-semibold flex-1">
          {q.data.length ? `${q.data.length} pessoa(s) com horas e cadastro incompleto` : "Todos com horas no mês têm vínculo e custo"}
        </h3>
        <MonthField aria-label="Mês das pendências" value={month} onChange={setMonth} className="h-8 w-40" />
      </div>
      {q.data.length > 0 && (
        <ul className="divide-y text-sm">
          {q.data.map((g) => (
            <li key={g.user_id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="flex-1 min-w-0 truncate font-medium">{g.name}</span>
              <span className="tabular-nums text-muted-foreground">{fmtHours(Number(g.hours))}</span>
              {g.missing_kind && <Button variant="outline" size="sm" className="h-7" onClick={() => onFixKind(g.user_id)}>Sem vínculo · cadastrar</Button>}
              {g.missing_cost && <Button variant="outline" size="sm" className="h-7" onClick={() => onFixCost(g.user_id, month)}>Sem custo · cadastrar</Button>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
