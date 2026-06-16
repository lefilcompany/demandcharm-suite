import { useState } from "react";
import { Trophy, Crown, Shield, Briefcase, UserCheck, TrendingUp, Clock, Target, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useLiveTimer, formatTimeDisplay } from "@/hooks/useLiveTimer";
import { BoardMemberWithTime, BoardMemberRole } from "@/hooks/useBoardTimeEntries";
import { cn } from "@/lib/utils";

interface MemberRankingProps {
  members: BoardMemberWithTime[];
  activeTimersCount: number;
  maxUserTime: number;
}

const roleLabels: Record<BoardMemberRole, string> = {
  admin: "Admin",
  moderator: "Coord.",
  executor: "Agente",
  requester: "Solic."
};

const roleIcons: Record<BoardMemberRole, typeof Crown> = {
  admin: Crown,
  moderator: Shield,
  executor: Briefcase,
  requester: UserCheck
};

type SortMode = "time" | "demands" | "delivered";

const sortLabels: Record<SortMode, string> = {
  time: "Tempo",
  demands: "Demandas",
  delivered: "Entregas"
};

export function MemberRanking({
  members,
  activeTimersCount,
}: MemberRankingProps) {
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortMode, setSortMode] = useState<SortMode>("time");

  // Filter members by role
  const filteredByRole = roleFilter === "all" ? members : members.filter(m => m.role === roleFilter);

  // Sort members based on selected mode
  const sortedMembers = [...filteredByRole].sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    switch (sortMode) {
      case "time":
        return b.totalSeconds - a.totalSeconds;
      case "demands":
        return b.demandCount - a.demandCount;
      case "delivered":
        return b.deliveredCount - a.deliveredCount;
      default:
        return b.totalSeconds - a.totalSeconds;
    }
  });

  // Calculate max for progress bars based on sort mode
  const maxValue = sortedMembers.length > 0 
    ? sortMode === "time" 
      ? Math.max(...sortedMembers.map(m => m.totalSeconds)) 
      : sortMode === "demands" 
        ? Math.max(...sortedMembers.map(m => m.demandCount)) 
        : Math.max(...sortedMembers.map(m => m.deliveredCount)) 
    : 0;

  // Stats summary
  const totalDemands = members.reduce((sum, m) => sum + m.demandCount, 0);
  const totalDelivered = members.reduce((sum, m) => sum + m.deliveredCount, 0);

  // Check if there is ranking data
  const topMembers = sortedMembers.slice(0, 3);
  const hasRankingData = topMembers.some(m => 
    sortMode === "time" ? m.totalSeconds > 0 : sortMode === "demands" ? m.demandCount > 0 : m.deliveredCount > 0
  );

  const getMedalColor = (index: number) => {
    switch (index) {
      case 0:
        return "text-yellow-500";
      case 1:
        return "text-gray-400";
      case 2:
        return "text-amber-600";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3 sm:pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              Ranking de Carga
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Desempenho dos membros da equipe
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
              <SelectTrigger className="h-8 w-[100px] sm:w-[120px] text-xs sm:text-sm">
                <TrendingUp className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(sortLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-8 w-[90px] sm:w-[110px] text-xs sm:text-sm">
                <SelectValue placeholder="Cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="moderator">Coord.</SelectItem>
                <SelectItem value="executor">Agentes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary stats */}
        <div className="flex items-center gap-3 sm:gap-4 mt-3 pt-3 border-t text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" />
            <span><strong>{totalDemands}</strong> demandas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span><strong>{totalDelivered}</strong> entregas</span>
          </div>
          {activeTimersCount > 0 && (
            <div className="flex items-center gap-1.5 text-primary">
              <Clock className="h-3.5 w-3.5 animate-pulse" />
              <span><strong>{activeTimersCount}</strong> ativos</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {!hasRankingData ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nenhum dado de {sortLabels[sortMode].toLowerCase()} disponível
          </div>
        ) : (
          <div className="space-y-2">
            {sortedMembers.map((member, index) => (
              <MemberRow
                key={member.userId}
                member={member}
                index={index}
                sortMode={sortMode}
                maxValue={maxValue}
                getMedalColor={getMedalColor}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Separate component for each member row to properly use hooks
function MemberRow({
  member,
  index,
  sortMode,
  maxValue,
  getMedalColor,
}: {
  member: BoardMemberWithTime;
  index: number;
  sortMode: SortMode;
  maxValue: number;
  getMedalColor: (index: number) => string;
}) {
  const RoleIcon = roleIcons[member.role];

  const getValue = (m: BoardMemberWithTime) => {
    switch (sortMode) {
      case "time":
        return m.totalSeconds;
      case "demands":
        return m.demandCount;
      case "delivered":
        return m.deliveredCount;
    }
  };

  const getDisplayValue = (m: BoardMemberWithTime) => {
    switch (sortMode) {
      case "time":
        return formatTimeDisplay(m.totalSeconds) || "00:00:00";
      case "demands":
        return `${m.demandCount} demandas`;
      case "delivered":
        return `${m.deliveredCount} entregas`;
    }
  };

  const value = getValue(member);
  const progressPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;
  const isTop3 = index < 3 && value > 0;

  // Use the live timer hook for active members
  const liveTime = useLiveTimer({
    isActive: member.isActive,
    baseSeconds: member.totalSeconds,
    lastStartedAt: member.activeStartedAt,
  });

  return (
    <div
      className={cn(
        "flex items-center gap-2 sm:gap-3 p-2 sm:p-3 rounded-lg transition-colors",
        member.isActive ? "bg-primary/10 border border-primary/20" : "bg-muted/30 hover:bg-muted/50"
      )}
    >
      {/* Position / Medal */}
      <div className="w-6 sm:w-8 text-center shrink-0">
        {isTop3 ? (
          <Trophy className={cn("h-4 w-4 sm:h-5 sm:w-5 mx-auto", getMedalColor(index))} />
        ) : (
          <span className="text-xs sm:text-sm font-medium text-muted-foreground">
            {index + 1}º
          </span>
        )}
      </div>

      {/* Avatar */}
      <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
        <AvatarImage src={member.profile.avatar_url || undefined} />
        <AvatarFallback className="text-xs">
          {member.profile.full_name?.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Name and Role */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="font-medium text-xs sm:text-sm truncate">
            {member.profile.full_name}
          </span>
          {member.isActive && (
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 gap-0.5">
            <RoleIcon className="h-2.5 w-2.5" />
            {roleLabels[member.role]}
          </Badge>
          <Progress value={progressPercent} className="h-1.5 flex-1 max-w-[60px] sm:max-w-[100px]" />
        </div>
      </div>

      {/* Value display */}
      <div className="text-right shrink-0">
        {sortMode === "time" && member.isActive ? (
          <span className="text-xs sm:text-sm font-mono font-semibold text-primary">
            {liveTime || formatTimeDisplay(member.totalSeconds) || "00:00:00"}
          </span>
        ) : (
          <span className={cn(
            "text-xs sm:text-sm font-mono font-semibold",
            member.isActive && "text-primary"
          )}>
            {getDisplayValue(member)}
          </span>
        )}
        <div className="text-[10px] text-muted-foreground hidden sm:block">
          {sortMode === "time" 
            ? `${member.demandCount} demandas` 
            : formatTimeDisplay(member.totalSeconds) || "00:00:00"}
        </div>
      </div>
    </div>
  );
}
