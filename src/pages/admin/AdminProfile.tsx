import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SEOHead } from "@/components/SEOHead";
import {
  Camera, Loader2, Save, User, Mail, Lock, Eye, EyeOff,
  MapPin, Link as LinkIcon, Github, Linkedin, Briefcase, Phone,
  CheckCircle2, XCircle,
} from "lucide-react";

export default function AdminProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [currentPasswordVerified, setCurrentPasswordVerified] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Form state
  const [form, setForm] = useState<Record<string, string>>({});

  // Initialize form when profile loads
  const initialized = useRef(false);
  if (profile && !initialized.current) {
    initialized.current = true;
    setForm({
      full_name: profile.full_name || "",
      bio: (profile as any)?.bio || "",
      job_title: (profile as any)?.job_title || "",
      location: (profile as any)?.location || "",
      phone: profile.phone || "",
      website: (profile as any)?.website || "",
      linkedin_url: (profile as any)?.linkedin_url || "",
      github_url: (profile as any)?.github_url || "",
    });
  }

  const updateField = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione uma imagem válida");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const filePath = `${user.id}/avatar_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl } as any)
        .eq("id", user.id);

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Foto atualizada!");
    } catch {
      toast.error("Erro ao enviar imagem");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.full_name?.trim()) {
      toast.error("O nome é obrigatório");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          bio: form.bio?.trim() || null,
          job_title: form.job_title?.trim() || null,
          location: form.location?.trim() || null,
          phone: form.phone?.trim() || null,
          website: form.website?.trim() || null,
          linkedin_url: form.linkedin_url?.trim() || null,
          github_url: form.github_url?.trim() || null,
        } as any)
        .eq("id", user.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil atualizado com sucesso!");
    } catch {
      toast.error("Erro ao salvar perfil");
    } finally {
      setIsSaving(false);
    }
  };

  const handleVerifyCurrentPassword = async () => {
    if (!currentPassword) {
      toast.error("Informe a senha atual");
      return;
    }
    setIsVerifyingPassword(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: currentPassword,
      });
      if (error) {
        toast.error("Senha atual incorreta");
        setCurrentPasswordVerified(false);
        return;
      }
      setCurrentPasswordVerified(true);
      toast.success("Senha verificada! Agora defina a nova senha.");
    } catch {
      toast.error("Erro ao verificar senha");
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPasswordVerified) {
      toast.error("Verifique a senha atual primeiro");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPasswordVerified(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao alterar senha");
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <SEOHead title="Admin - Perfil" />
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const passwordsMismatch = confirmPassword && newPassword !== confirmPassword;

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <SEOHead title="Admin - Perfil" />
      <div>
        <h1 className="text-2xl font-bold">Meu Perfil</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie suas informações pessoais e credenciais
        </p>
      </div>

      {/* Avatar & Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Informações Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative group">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage
                  src={profile?.avatar_url || undefined}
                  alt={profile?.full_name}
                  className="object-cover"
                />
                <AvatarFallback className="text-xl bg-primary/10 text-primary font-semibold">
                  {profile?.full_name ? getInitials(profile.full_name) : "?"}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                {isUploading ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>
            <div>
              <p className="font-medium">{profile?.full_name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <Separator />

          {/* Fields grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                Nome Completo *
              </Label>
              <Input
                value={form.full_name || ""}
                onChange={(e) => updateField("full_name", e.target.value)}
                placeholder="Seu nome"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                E-mail
              </Label>
              <Input value={user?.email || ""} disabled className="bg-muted/50" />
              <p className="text-xs text-muted-foreground">Não é possível alterar o e-mail</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                Cargo
              </Label>
              <Input
                value={form.job_title || ""}
                onChange={(e) => updateField("job_title", e.target.value)}
                placeholder="Ex: CTO, Product Manager"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                Telefone
              </Label>
              <Input
                value={form.phone || ""}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                Localização
              </Label>
              <Input
                value={form.location || ""}
                onChange={(e) => updateField("location", e.target.value)}
                placeholder="São Paulo, SP"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Biografia</Label>
            <Textarea
              value={form.bio || ""}
              onChange={(e) => updateField("bio", e.target.value)}
              placeholder="Conte um pouco sobre você..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            Links e Redes Sociais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                Website
              </Label>
              <Input
                value={form.website || ""}
                onChange={(e) => updateField("website", e.target.value)}
                placeholder="https://seusite.com"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Linkedin className="h-3.5 w-3.5 text-muted-foreground" />
                LinkedIn
              </Label>
              <Input
                value={form.linkedin_url || ""}
                onChange={(e) => updateField("linkedin_url", e.target.value)}
                placeholder="https://linkedin.com/in/seuperfil"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-sm">
                <Github className="h-3.5 w-3.5 text-muted-foreground" />
                GitHub
              </Label>
              <Input
                value={form.github_url || ""}
                onChange={(e) => updateField("github_url", e.target.value)}
                placeholder="https://github.com/seuusuario"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Segurança
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            {/* Current password + verify */}
            <div className="space-y-2">
              <Label className="text-sm">Senha Atual *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      if (currentPasswordVerified) setCurrentPasswordVerified(false);
                    }}
                    placeholder="Digite sua senha atual"
                    disabled={currentPasswordVerified}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {!currentPasswordVerified ? (
                  <Button
                    variant="outline"
                    onClick={handleVerifyCurrentPassword}
                    disabled={isVerifyingPassword || !currentPassword}
                    className="gap-2 shrink-0"
                  >
                    {isVerifyingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                    Verificar
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400 shrink-0 px-3">
                    <CheckCircle2 className="h-4 w-4" />
                    Verificada
                  </div>
                )}
              </div>
            </div>

            {/* New password fields - only enabled after verification */}
            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity ${currentPasswordVerified ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
              <div className="space-y-2">
                <Label className="text-sm">Nova Senha</Label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    disabled={!currentPasswordVerified}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Confirmar Nova Senha</Label>
                <div className="relative">
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    disabled={!currentPasswordVerified}
                  />
                  {passwordsMatch && (
                    <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                  )}
                  {passwordsMismatch && (
                    <XCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                  )}
                </div>
                {passwordsMismatch && (
                  <p className="text-xs text-destructive">As senhas não coincidem</p>
                )}
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleChangePassword}
            disabled={isChangingPassword || !currentPasswordVerified || !newPassword || !passwordsMatch}
            className="gap-2"
          >
            {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Alterar Senha
          </Button>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2 min-w-[160px]">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Alterações
        </Button>
      </div>
    </div>
  );
}
