import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Landmark, Link2, Unlink, AlertTriangle } from "lucide-react";
import { useCanManageFinance, useTeamBoards, useProjectBoards, usePendingDemands, useFinanceMutation } from "@/hooks/useProjectFinance";
import { PENDING_REASON_LABEL } from "@/lib/finance/attribution";

const ERR: Record<string, string> = {
  PROJECT_BOARD_OVERLAP: "Esse quadro já está vinculado a este projeto nesse período.",
  PROJECT_BOARD_TEAM_MISMATCH: "O quadro precisa ser da mesma equipe do projeto.",
  PERIOD_CLOSED: "Este mês já foi fechado.",
  INVALID_PROJECT: "Ative o controle financeiro do projeto antes de atribuir demandas.",
};
const msg = (e: any) => Object.entries(ERR).find(([k]) => String(e?.message).includes(k))?.[1] ?? "Não foi possível salvar.";
const fmt = (d: string) => d.substring(0, 10).split("-").reverse().join("/");

export function ProjectFinancePanel({ projectId, teamId }: { projectId: string; teamId: string | null }) {
  const { toast } = useToast();
  const competence = `${new Date().toISOString().substring(0, 7)}-01`;
  const { data: canManage } = useCanManageFinance(teamId);
  const { data: boards = [] } = useTeamBoards(teamId);
  const { data: links = [], isError } = useProjectBoards(teamId);
  const project = useQuery({
    queryKey: ["project-finance-config", projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, finance_enabled, unit_external_id").eq("id", projectId).single();
      if (error) throw error;
      return data;
    },
  });
  const pending = usePendingDemands(teamId, competence, !!canManage);
  const [boardToAdd, setBoardToAdd] = useState("");
  const [unit, setUnit] = useState<string | null>(null);
  const fail = (e: any) => toast({ title: msg(e), variant: "destructive" });

  const mine = links.filter((l: any) => l.project_id === projectId);
  const active = mine.filter((l: any) => !l.valid_to);
  const boardName = (id: string) => boards.find((b) => b.id === id)?.name ?? "Quadro";
  const sharedElsewhere = (boardId: string) => links.some((l: any) => l.board_id === boardId && l.project_id !== projectId && !l.valid_to);

  const link = useFinanceMutation(async (boardId: string) => {
    const { error } = await supabase.from("project_boards").insert({ project_id: projectId, board_id: boardId, team_id: teamId!, valid_from: competence });
    if (error) throw error;
  });
  const unlink = useFinanceMutation(async (id: string) => {
    const today = new Date().toISOString().substring(0, 10);
    const { error } = await supabase.from("project_boards").update({ valid_to: today }).eq("id", id);
    if (error) throw error;
  });
  const saveCfg = useFinanceMutation(async (v: { finance_enabled?: boolean; unit_external_id?: string | null }) => {
    const { error } = await supabase.from("projects").update(v).eq("id", projectId);
    if (error) throw error;
    await project.refetch();
  });
  const assign = useFinanceMutation(async (demandId: string) => {
    const { error } = await supabase.rpc("finance_assign_demand", { _demand_id: demandId, _competence: competence, _project_id: projectId });
    if (error) throw error;
  });

  if (isError) return null;
  const enabled = !!project.data?.finance_enabled;
  const candidates = boards.filter((b) => !active.some((l: any) => l.board_id === b.id));

  return (
    <section className="rounded-xl border bg-card p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Landmark className="h-5 w-5 text-primary" />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold">Base financeira do projeto</h2>
          <p className="text-sm text-muted-foreground">Quadros vinculados somam horas neste projeto. Cada demanda tem um único destino financeiro por mês.</p>
        </div>
        {canManage && (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={enabled} onCheckedChange={(v) => saveCfg.mutate({ finance_enabled: v }, { onError: fail })} />
            Controle financeiro {enabled ? "ativo" : "desligado"}
          </label>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Quadros vinculados ({active.length})</h3>
          {active.length === 0 && <p className="text-sm text-muted-foreground">Nenhum quadro vinculado ainda.</p>}
          <ul className="divide-y text-sm">
            {active.map((l: any) => (
              <li key={l.id} className="flex items-center gap-2 py-2">
                <span className="flex-1 truncate">{boardName(l.board_id)}</span>
                {sharedElsewhere(l.board_id) && <span className="text-xs text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" />também em outro projeto</span>}
                <span className="text-xs text-muted-foreground tabular-nums">desde {fmt(l.valid_from)}</span>
                {canManage && (
                  <Button variant="ghost" size="sm" className="h-7" aria-label="Desvincular quadro" onClick={() => unlink.mutate(l.id, { onError: fail })}>
                    <Unlink className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {canManage && candidates.length > 0 && (
            <div className="flex gap-2">
              <Select value={boardToAdd} onValueChange={setBoardToAdd}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Escolha um quadro" /></SelectTrigger>
                <SelectContent>{candidates.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" className="h-9" disabled={!boardToAdd} onClick={() => link.mutate(boardToAdd, { onSuccess: () => setBoardToAdd(""), onError: fail })}>
                <Link2 className="h-4 w-4 mr-1" />Vincular
              </Button>
            </div>
          )}
          {canManage && (
            <div className="flex gap-2 items-end pt-2">
              <label className="flex-1 space-y-1 text-sm">
                <span className="text-muted-foreground">Código da unidade (opcional)</span>
                <Input className="h-9" value={unit ?? project.data?.unit_external_id ?? ""} onChange={(e) => setUnit(e.target.value)} placeholder="Ex.: LEFIL-FOR" />
              </label>
              <Button variant="outline" size="sm" className="h-9" disabled={unit === null}
                onClick={() => saveCfg.mutate({ unit_external_id: unit?.trim() || null }, { onSuccess: () => { setUnit(null); toast({ title: "Unidade salva" }); }, onError: fail })}>Salvar</Button>
            </div>
          )}
        </div>

        {canManage && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Demandas da equipe sem projeto financeiro neste mês ({pending.data?.length ?? 0})</h3>
            {pending.isError && <p className="text-sm text-destructive">Não foi possível carregar as pendências.</p>}
            {pending.data?.length === 0 && <p className="text-sm text-muted-foreground">Tudo classificado.</p>}
            <ul className="divide-y text-sm max-h-72 overflow-y-auto">
              {pending.data?.map((d: any) => (
                <li key={d.demand_id} className="flex items-center gap-2 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{d.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{d.board_name} · {PENDING_REASON_LABEL[d.reason] ?? "Pendente"}</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-7" disabled={!enabled} onClick={() => assign.mutate(d.demand_id, { onError: fail })}>Atribuir aqui</Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
