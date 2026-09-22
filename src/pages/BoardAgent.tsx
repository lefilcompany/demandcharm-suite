import { AlertCircle, MessageSquareText } from "lucide-react";
import { useSelectedBoardSafe } from "@/contexts/BoardContext";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent } from "@/components/ui/card";
import { BoardAgentChat } from "@/components/board-agent/BoardAgentChat";

export default function BoardAgent() {
  const { currentBoard, selectedBoardId } = useSelectedBoardSafe();

  if (!currentBoard || !selectedBoardId) {
    return (
      <div className="container mx-auto py-6 px-4">
        <SEOHead title="Assistente do Quadro" noindex />
        <PageBreadcrumb items={[{ label: "Assistente do Quadro", icon: MessageSquareText }]} />
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">Selecione um quadro para conversar com o assistente</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col animate-fade-in">
      <SEOHead title={`Assistente - ${currentBoard.name}`} noindex />
      <div className="shrink-0 pb-3">
        <PageBreadcrumb items={[{ label: "Assistente do Quadro", icon: MessageSquareText }]} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
        {/* key força uma conversa isolada por quadro */}
        <BoardAgentChat key={selectedBoardId} boardId={selectedBoardId} boardName={currentBoard.name} />
      </div>
    </div>
  );
}
