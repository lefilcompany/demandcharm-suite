import { TeamCostsPanel } from "@/components/finance/TeamCostsPanel";
import type { FinancePermission } from "@/hooks/useFinance";
import type { OverviewRow } from "@/hooks/useFinance";

interface Props {
  teamId: string;
  boards: { id: string; name: string }[];
  members: { user_id: string; name: string }[];
  can: (p: FinancePermission, boardId?: string) => boolean;
  canAny: (p: FinancePermission) => boolean;
  isOwnerOrAdmin: boolean;
  overview?: OverviewRow[];
}

// Gestão financeira > Custos: apenas os custos da equipe (fixo, operacional e administrativo).
export function FinanceManage({ teamId, can }: Props) {
  return <TeamCostsPanel teamId={teamId} canEdit={can("finance.manage_settings")} />;
}
