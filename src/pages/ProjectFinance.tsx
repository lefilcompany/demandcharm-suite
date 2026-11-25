import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useSelectedBoard } from "@/contexts/BoardContext";
import { useDemandFolders } from "@/hooks/useDemandFolders";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { Button } from "@/components/ui/button";
import { ProjectFinancePanel } from "@/components/finance/ProjectFinancePanel";
import { useFinanceAccess } from "@/hooks/useFinance";
import { SEOHead } from "@/components/SEOHead";
import { ProjectStatusBadge, ProjectStatusButton } from "@/components/projects/ProjectStatusControl";
import { Briefcase, FolderOpen, Wallet, ArrowLeft, Landmark } from "lucide-react";

export default function ProjectFinance() {
  const { folderId } = useParams<{ folderId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentTeamId } = useSelectedBoard();
  const { data: folders } = useDemandFolders(currentTeamId, user?.id);
  const folder = folders?.find((f) => f.id === folderId);
  const financeAccess = useFinanceAccess(currentTeamId);

  if (!folder) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-muted-foreground">Projeto não encontrado</p>
        <Button variant="outline" onClick={() => navigate("/app/projects")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para projetos
        </Button>
      </div>
    );
  }

  if (!financeAccess.isLoading && !financeAccess.hasModule) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <Landmark className="h-8 w-8 text-muted-foreground" />
        <p className="text-muted-foreground">Você não tem permissão para ver a gestão financeira deste projeto.</p>
        <Button variant="outline" onClick={() => navigate(`/app/projects/${folder.id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao projeto
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      <SEOHead title={`Gestão financeira - ${folder.name}`} />
      <PageBreadcrumb
        items={[
          { label: "Projetos", href: "/app/projects", icon: Briefcase },
          { label: folder.name, href: `/app/projects/${folder.id}`, icon: FolderOpen },
          { label: "Gestão financeira", icon: Wallet, isCurrent: true },
        ]}
      />

      <div className="flex items-center gap-3">
        <Wallet className="h-6 w-6 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground truncate">Gestão financeira · {folder.name} <ProjectStatusBadge status={folder.status} /></h1>
          <p className="text-xs text-muted-foreground">
            Resultado, horas e custos, quadros vinculados, preço mínimo e configuração do projeto.
          </p>
        </div>
        <ProjectStatusButton project={folder} />
        <button
          type="button"
          onClick={() => navigate(`/app/projects/${folder.id}`)}
          className="flex items-center gap-1.5 p-2 md:px-3 md:py-1.5 rounded-lg border border-border/60 hover:bg-muted/60 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
          <span className="hidden md:inline text-xs font-medium text-muted-foreground">Voltar ao projeto</span>
        </button>
      </div>

      <ProjectFinancePanel projectId={folder.id} teamId={currentTeamId} />
    </div>
  );
}
