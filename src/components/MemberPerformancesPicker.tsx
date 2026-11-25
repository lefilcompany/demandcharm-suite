import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { PositionBadge } from "@/components/PositionBadge";
import { TeamPosition, useTogglePerformanceMember } from "@/hooks/useTeamPositions";
import type { TeamMember } from "@/hooks/useTeamMembers";
import { canJoinPerformance } from "@/lib/performances";

interface Props {
  teamId: string;
  member: TeamMember;
  performances: TeamPosition[];
  canManage: boolean;
  align?: "center" | "start";
}

/** Badges das performances do membro + seletor de múltipla escolha para quem gerencia. */
export function MemberPerformancesPicker({ teamId, member, performances, canManage, align = "center" }: Props) {
  const toggle = useTogglePerformanceMember();
  const current = new Set(member.performances.map((p) => p.id));
  const eligible = canJoinPerformance(member.member_kind);

  const onToggle = (performanceId: string, add: boolean) =>
    toggle.mutate(
      { performanceId, memberId: member.id, add, teamId },
      { onError: (e: any) => toast.error(e?.message || "Não foi possível alterar a performance") },
    );

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${align === "center" ? "justify-center" : ""}`}>
      {member.performances.map((p) => (
        <PositionBadge key={p.id} name={p.name} color={p.color} textColor={p.text_color} showIcon={false} className="text-xs" />
      ))}
      {canManage && eligible && performances.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 rounded-full border border-dashed border-input px-2 text-xs font-medium text-muted-foreground hover:border-primary hover:bg-transparent hover:text-primary"
            >
              <Plus className="h-3 w-3" />
              {member.performances.length === 0 ? "Performance" : ""}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-60 p-2" align="center">
            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-semibold text-muted-foreground">
              <Users className="h-3 w-3" /> Performances
            </p>
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {performances.map((p) => {
                const checked = current.has(p.id);
                return (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted">
                    <Checkbox checked={checked} disabled={toggle.isPending} onCheckedChange={(v) => onToggle(p.id, !!v)} />
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="truncate">{p.name}</span>
                  </label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
