import { useSelectedTeam } from "@/contexts/TeamContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function TeamSelector() {
  const navigate = useNavigate();
  const { isLoading, hasTeams, currentTeam } = useSelectedTeam();

  if (isLoading) {
    return <div className="h-6 w-32 animate-pulse rounded-md bg-muted" />;
  }

  if (!hasTeams) {
    return (
      <Button variant="outline" size="sm" onClick={() => navigate("/welcome")} className="gap-2">
        <UserPlus className="h-4 w-4" />
        Entrar em Equipe
      </Button>
    );
  }

  return (
    <Badge variant="secondary" className="bg-primary/10 border border-primary/20 text-foreground text-xs whitespace-nowrap cursor-default hover:bg-primary/10">
      <Users className="h-3 w-3 mr-1" />
      {currentTeam?.name || "Equipe"}
    </Badge>
  );
}
