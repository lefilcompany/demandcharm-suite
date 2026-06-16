import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { SectionShell } from "./SectionShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Shield, FileText, ScrollText, HelpCircle, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function AccountSection() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/auth");
    } catch {
      toast.error("Erro ao sair");
    }
  };

  return (
    <div className="space-y-6">
      <SectionShell icon={Shield} title="Informações Legais" description="Políticas e termos">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/privacy-policy")}>
            <FileText className="mr-2 h-4 w-4" />Política de Privacidade
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/terms-of-service")}>
            <ScrollText className="mr-2 h-4 w-4" />Termos de Uso
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.open("mailto:suporte@somaplus.com.br", "_blank")}>
            <HelpCircle className="mr-2 h-4 w-4" />Central de Ajuda
          </Button>
        </div>
      </SectionShell>

      <Card className="shadow-sm border border-destructive/20 rounded-xl">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <Trash2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-destructive leading-tight">Zona de Perigo</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Ações irreversíveis</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 p-4 rounded-lg border bg-muted/30">
            <div>
              <p className="font-medium text-sm">Sair da conta</p>
              <p className="text-xs text-muted-foreground">Encerrar a sessão atual</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />Sair
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
            <div>
              <p className="font-medium text-sm text-destructive">Excluir conta</p>
              <p className="text-xs text-muted-foreground">Remove todos os seus dados permanentemente</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-2 h-4 w-4" />Excluir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir sua conta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação é irreversível. Para excluir sua conta, entre em contato com o suporte em
                    <strong> suporte@somaplus.com.br</strong>. Nossa equipe processará a exclusão em até 48h.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => window.open("mailto:suporte@somaplus.com.br?subject=Exclusão%20de%20conta", "_blank")}>
                    Contatar suporte
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
