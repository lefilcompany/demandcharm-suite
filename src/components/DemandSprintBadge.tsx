import { Link } from "react-router-dom";
import { Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useDemandSprint } from "@/hooks/useSprints";
import { SPRINT_STATUS_LABEL } from "@/lib/sprints";

export function DemandSprintBadge({ demandId }: { demandId: string }) {
  const { data: sprint } = useDemandSprint(demandId);
  if (!sprint) return null;
  return (
    <Link to="/app/sprints">
      <Badge variant="outline" className="gap-1 hover:bg-muted">
        <Rocket className="h-3 w-3" /> {sprint.name} · {SPRINT_STATUS_LABEL[sprint.status]}
      </Badge>
    </Link>
  );
}
