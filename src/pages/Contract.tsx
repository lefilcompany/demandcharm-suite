import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Upload, Loader2, RefreshCw, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useTeamRole } from "@/hooks/useTeamRole";
import { useContract, useCreateContract, useDeleteContract } from "@/hooks/useContracts";
import { SEOHead } from "@/components/SEOHead";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function Contract() {
  const { t } = useTranslation();
  const { selectedTeamId } = useSelectedTeam();
  const { data: role, isLoading: roleLoading } = useTeamRole(selectedTeamId);
  const { data: contract, isLoading: contractLoading, refetch } = useContract(selectedTeamId);
  const createContract = useCreateContract();
  const deleteContract = useDeleteContract();

  const [originalText, setOriginalText] = useState("");

  const canManage = role === "owner";
  const isLoading = roleLoading || contractLoading;

  const handleSubmit = async () => {
    if (!selectedTeamId || !originalText.trim()) return;
    
    await createContract.mutateAsync({
      teamId: selectedTeamId,
      originalContent: originalText.trim(),
    });
    
    setOriginalText("");
  };

  const handleDelete = async () => {
    if (!contract || !selectedTeamId) return;
    await deleteContract.mutateAsync({ 
      contractId: contract.id, 
      teamId: selectedTeamId 
    });
  };

  const handleReprocess = async () => {
    if (!contract?.original_content || !selectedTeamId) return;
    
    await createContract.mutateAsync({
      teamId: selectedTeamId,
      originalContent: contract.original_content,
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SEOHead title="Contrato" path="/contract" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <SEOHead title="Contrato" path="/contract" />
      <PageBreadcrumb
        items={[
          { label: "Meu Contrato", icon: FileText, isCurrent: true },
        ]}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Meu Contrato</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            {canManage 
              ? "Faça upload ou cole o texto do contrato para análise e formatação com IA" 
              : "Visualize o contrato da equipe"}
          </p>
        </div>
      </div>

      {/* Admin/Moderator Upload Section */}
      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Enviar Contrato
            </CardTitle>
            <CardDescription>
              Cole o texto do contrato abaixo. A IA irá analisar e reescrever de forma clara e organizada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Cole o texto do contrato aqui..."
              value={originalText}
              onChange={(e) => setOriginalText(e.target.value)}
              className="min-h-[200px]"
            />
            <div className="flex gap-2">
              <Button 
                onClick={handleSubmit} 
                disabled={!originalText.trim() || createContract.isPending}
              >
                {createContract.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Processar com IA
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contract Display */}
      {contract ? (
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Contrato Processado
                </CardTitle>
                <CardDescription>
                  Última atualização: {new Date(contract.updated_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </CardDescription>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReprocess}
                    disabled={createContract.isPending || contract.status === 'processing'}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Reprocessar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir contrato?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita. O contrato será removido permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {contract.status === 'processing' ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 mr-2 animate-spin" />
                Processando contrato com IA...
              </div>
            ) : contract.status === 'error' ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Erro ao processar o contrato. Tente reprocessar.
                </AlertDescription>
              </Alert>
            ) : contract.processed_content ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap bg-muted/30 rounded-lg p-6 border">
                  {contract.processed_content}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Nenhum conteúdo processado disponível.
              </p>
            )}
          </CardContent>
        </Card>
      ) : !canManage ? (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Nenhum contrato disponível</h3>
          <p className="text-muted-foreground">
            A equipe ainda não publicou um contrato.
          </p>
        </Card>
      ) : null}

      {/* Refresh button for polling */}
      {contract?.status === 'processing' && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Verificar status
          </Button>
        </div>
      )}
    </div>
  );
}
