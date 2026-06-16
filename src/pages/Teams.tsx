import { Button } from "@/components/ui/button";
import { TeamCard } from "@/components/TeamCard";
import { useTeams } from "@/hooks/useTeams";
import { Plus, Users as UsersIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { SEOHead } from "@/components/SEOHead";

export default function Teams() {
  const navigate = useNavigate();
  const { data: teams, isLoading } = useTeams();

  return (
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      <SEOHead title="Equipes" path="/teams" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Equipes</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Gerencie suas equipes e membros
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/teams/join")} variant="outline" className="flex-1 sm:flex-none">
            <UsersIcon className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Entrar em Equipe</span>
            <span className="sm:hidden">Entrar</span>
          </Button>
          <Button onClick={() => navigate("/teams/create")} className="flex-1 sm:flex-none">
            <Plus className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Criar Equipe</span>
            <span className="sm:hidden">Criar</span>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando equipes...</p>
        </div>
      ) : teams && teams.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <UsersIcon className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">Nenhuma equipe encontrada</h3>
          <p className="text-muted-foreground mt-2">
            Comece criando uma nova equipe ou entre com um código de acesso.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={() => navigate("/teams/create")}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Equipe
            </Button>
            <Button onClick={() => navigate("/teams/join")} variant="outline">
              <UsersIcon className="mr-2 h-4 w-4" />
              Entrar em Equipe
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

