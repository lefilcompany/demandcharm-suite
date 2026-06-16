import { format } from "date-fns";
import { Users, BarChart3, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { UserDetailTimeRow } from "@/components/UserDetailTimeRow";
import { DemandDetailTimeRow } from "@/components/DemandDetailTimeRow";
import { BoardMemberWithTime, BoardTimeEntry } from "@/hooks/useBoardTimeEntries";

interface GroupedByDemand {
  demand: BoardTimeEntry["demand"];
  entries: BoardTimeEntry[];
  totalSeconds: number;
  users: Map<string, { profile: BoardTimeEntry["profile"]; totalSeconds: number }>;
  hasActiveTimer: boolean;
}

interface TimeDetailTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  members: BoardMemberWithTime[];
  groupedByDemand: GroupedByDemand[];
  expandedUsers: Set<string>;
  expandedDemands: Set<string>;
  onToggleUser: (userId: string) => void;
  onToggleDemand: (demandId: string) => void;
  isLoading: boolean;
  startDate?: Date;
  endDate?: Date;
}

export function TimeDetailTabs({
  activeTab,
  onTabChange,
  members,
  groupedByDemand,
  expandedUsers,
  expandedDemands,
  onToggleUser,
  onToggleDemand,
  isLoading,
  startDate,
  endDate,
}: TimeDetailTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange}>
      <TabsList className="grid w-full grid-cols-2 max-w-full sm:max-w-md">
        <TabsTrigger value="users" className="gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
          <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Por Usuário</span>
        </TabsTrigger>
        <TabsTrigger value="demands" className="gap-1.5 sm:gap-2 text-xs sm:text-sm px-2 sm:px-4">
          <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Por Demanda</span>
        </TabsTrigger>
      </TabsList>

      {/* Tab: Por Usuário */}
      <TabsContent value="users" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por Usuário</CardTitle>
            <CardDescription>
              Clique em um usuário para ver as demandas trabalhadas.
              {startDate && endDate && (
                <span className="ml-2 text-xs">
                  (Período: {format(startDate, "dd/MM/yyyy")} - {format(endDate, "dd/MM/yyyy")})
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhum membro encontrado neste quadro.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <UserDetailTimeRow
                    key={member.userId}
                    userData={{
                      userId: member.userId,
                      profile: member.profile,
                      role: member.role,
                      totalSeconds: member.totalSeconds,
                      isActive: member.isActive,
                      activeStartedAt: member.activeStartedAt,
                      demandCount: member.demandCount,
                      deliveredCount: member.deliveredCount,
                      inProgressCount: member.inProgressCount,
                      entries: member.entries,
                    }}
                    isExpanded={expandedUsers.has(member.userId)}
                    onToggle={() => onToggleUser(member.userId)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab: Por Demanda */}
      <TabsContent value="demands" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Detalhamento por Demanda</CardTitle>
            <CardDescription>
              Clique em uma demanda para ver os usuários que trabalharam nela.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : groupedByDemand.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma demanda encontrada com tempo registrado.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {groupedByDemand.map((demandData) => (
                  <DemandDetailTimeRow
                    key={demandData.demand.id}
                    demandData={demandData}
                    isExpanded={expandedDemands.has(demandData.demand.id)}
                    onToggle={() => onToggleDemand(demandData.demand.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
