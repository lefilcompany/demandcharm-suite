import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SectionShell } from "./SectionShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { KeyRound, Eye, EyeOff, Loader2, Lock, CheckCircle2, XCircle } from "lucide-react";

export function SecuritySection() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [verified, setVerified] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const verify = async () => {
    if (!currentPassword || !user?.email) return;
    setIsVerifying(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (error) {
        toast.error("Senha incorreta");
        setVerified(false);
      } else {
        setVerified(true);
        toast.success("Senha verificada!");
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const updatePassword = async () => {
    if (!verified || newPassword !== confirmPassword || newPassword.length < 6) return;
    setIsUpdating(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        if (error.message?.includes("different from the old password")) {
          toast.error("A nova senha deve ser diferente da atual");
        } else throw error;
        return;
      }
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setVerified(false);
    } catch {
      toast.error("Erro ao alterar senha");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <SectionShell icon={KeyRound} title="Alterar Senha" description="Mantenha sua conta segura">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Senha Atual</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); setVerified(false); }}
              placeholder="Digite sua senha atual"
              disabled={verified}
              className="pr-10"
            />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button type="button" variant={verified ? "outline" : "default"} onClick={verify}
            disabled={isVerifying || verified || !currentPassword}>
            {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> :
              verified ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : "Verificar"}
          </Button>
        </div>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Nova Senha</Label>
        <div className="relative">
          <Input
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            disabled={!verified}
            className="pr-10"
          />
          <button type="button" onClick={() => setShowNew(!showNew)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Confirmar Nova Senha</Label>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Repita a nova senha"
          disabled={!verified}
        />
        {confirmPassword && (
          <div className="flex items-center gap-1 text-xs">
            {newPassword === confirmPassword ? (
              <><CheckCircle2 className="h-3 w-3 text-green-500" /><span className="text-green-500">Senhas coincidem</span></>
            ) : (
              <><XCircle className="h-3 w-3 text-destructive" /><span className="text-destructive">Senhas não coincidem</span></>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={updatePassword} disabled={!verified || isUpdating || newPassword !== confirmPassword || newPassword.length < 6}>
          {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
          Atualizar senha
        </Button>
      </div>
    </SectionShell>
  );
}
