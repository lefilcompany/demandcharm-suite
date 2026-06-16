import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Calendar, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface TeamCardProps {
  team: {
    id: string;
    name: string;
    description?: string;
    access_code: string;
    created_at: string;
    profiles?: {
      full_name: string;
    };
  };
}

export function TeamCard({ team }: TeamCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/teams/${team.id}`);
  };
  return (
    <Card
      className="hover:shadow-lg transition-all cursor-pointer group"
      onClick={handleClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
              <span className="break-words">{team.name}</span>
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </CardTitle>
            {team.description && (
              <CardDescription className="line-clamp-2 text-sm">{team.description}</CardDescription>
            )}
          </div>
          <Badge variant="secondary" className="font-mono text-xs shrink-0">
            {team.access_code.slice(0, 8)}...
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-1 min-w-0">
            <Users className="h-4 w-4 shrink-0" />
            <span className="truncate">{team.profiles?.full_name || "Usuário"}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>
              {format(new Date(team.created_at), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
