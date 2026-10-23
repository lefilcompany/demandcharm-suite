import type { ReactNode } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CommandStrip, type CommandMetric } from "@/components/ops/OpsParts";
import { computeBoardPulse, type PulseDemand } from "@/lib/boardPulse";

interface Props {
  boardName?: string;
  demands: PulseDemand[] | undefined;
  userId?: string;
  isRequester?: boolean;
  scope?: { used: number; limit: number } | null;
  actions?: ReactNode;
}

export function BoardCommandStrip({ boardName, demands, userId, isRequester, scope, actions }: Props) {
  const now = new Date();
  const p = computeBoardPulse(demands ?? [], format(now, "yyyy-MM-dd"), userId);
  const total = Math.max(1, (demands ?? []).length);
  const open = Math.max(1, p.open);

  const metrics: CommandMetric[] = isRequester
    ? [
        { label: "Pendentes", value: p.pending, note: "aguardando início", gauge: p.pending / total },
        { label: "Em andamento", value: p.inProgress, note: "sendo feitas agora", gauge: p.inProgress / total },
        { label: "Entregues", value: p.delivered, note: `${p.deliveredMonth} neste mês`, gauge: p.delivered / total },
        scope && scope.limit > 0
          ? { label: "Uso do escopo", value: scope.used, note: `de ${scope.limit} no mês`, gauge: Math.min(1, scope.used / scope.limit) }
          : { label: "Atrasadas", value: p.overdue, note: p.overdue ? "passaram do prazo" : "nada atrasado", gauge: p.overdue / open },
      ]
    : [
        { label: "Em andamento", value: p.inProgress, note: `${p.pending} aguardando início`, gauge: p.inProgress / total },
        { label: "Atrasadas", value: p.overdue, note: p.overdue ? "passaram do prazo" : "nada atrasado", gauge: p.overdue / open },
        { label: "Entregues no mês", value: p.deliveredMonth, note: format(now, "MMMM", { locale: ptBR }), gauge: p.deliveredMonth / total },
        { label: "Minhas abertas", value: p.mine, note: p.mine ? "com você" : "nada com você", gauge: p.mine / open },
      ];

  return (
    <CommandStrip
      metrics={metrics}
      loading={!demands}
      title={boardName ? `Quadro ${boardName}` : "Quadro"}
      subtitle={format(now, "EEE dd/MM", { locale: ptBR })}
      actions={actions}
    />
  );
}
