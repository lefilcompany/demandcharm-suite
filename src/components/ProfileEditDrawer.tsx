import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Camera, Loader2, Save, User, Mail, Lock, Eye, EyeOff, 
  CheckCircle2, XCircle, MapPin, Link as LinkIcon, Github, 
  Linkedin, Briefcase 
} from "lucide-react";

interface ProfileEditDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileEditDrawer({ open, onOpenChange }: ProfileEditDrawerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [currentPasswordVerified, setCurrentPasswordVerified] = useState(false);

  const { data: profile } = useQuery({
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

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setAvatarUrl(profile.avatar_url || "");
      setBio((profile as any).bio || "");
      setJobTitle((profile as any).job_title || "");
      setLocation((profile as any).location || "");
      setWebsite((profile as any).website || "");
      setLinkedinUrl((profile as any).linkedin_url || "");
      setGithubUrl((profile as any).github_url || "");
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: { 
      full_name: string; 
      avatar_url: string | null;
      bio: string | null;
      job_title: string | null;
      location: string | null;
      website: string | null;
      linkedin_url: string | null;
      github_url: string | null;
    }) => {
      if (!user) throw new Error("Usuário não autenticado");
      
      const { error } = await supabase
        .from("profiles")
        .update(data as any)
        .eq("id", user.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast.success("Perfil atualizado com sucesso!");
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Erro ao atualizar perfil", {
        description: getErrorMessage(error),
      });
    },
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione uma imagem válida");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB");
      return;
    }

    setIsUploading(true);
    
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
      toast.success("Imagem carregada!");
    } catch (error: any) {
      toast.error("Erro ao fazer upload", {
        description: getErrorMessage(error),
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim()) {
      toast.error("O nome é obrigatório");
      return;
    }

    updateProfileMutation.mutate({
      full_name: fullName.trim(),
      avatar_url: avatarUrl || null,
      bio: bio.trim() || null,
      job_title: jobTitle.trim() || null,
      location: location.trim() || null,
      website: website.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      github_url: githubUrl.trim() || null,
    });
  };

  const handleVerifyPassword = async () => {
    if (!currentPassword.trim() || !user?.email) return;
    
    setIsVerifyingPassword(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      
      if (error) {
        toast.error("Senha incorreta");
        setCurrentPasswordVerified(false);
        return;
      }
      
      setCurrentPasswordVerified(true);
      toast.success("Senha verificada!");
    } catch (error) {
      toast.error("Erro ao verificar senha");
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPasswordVerified || newPassword !== confirmPassword || newPassword.length < 6) return;
    
    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      
      if (error) {
        if (error.message?.includes('different from the old password')) {
          toast.error("A nova senha deve ser diferente da atual");
          return;
        }
        throw error;
      }
      
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setCurrentPasswordVerified(false);
    } catch (error) {
      toast.error("Erro ao alterar senha");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle>Editar Perfil</SheetTitle>
          <SheetDescription>
            Atualize suas informações pessoais e senha
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="px-6 py-6 space-y-6">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="relative group">
                <Avatar className="h-20 w-20 border-2">
                  <AvatarImage src={avatarUrl} alt={fullName} className="object-cover" />
                  <AvatarFallback className="text-xl bg-primary/10 text-primary">
                    {fullName ? getInitials(fullName) : <User className="h-8 w-8" />}
                  </AvatarFallback>
                </Avatar>
                <label
                  htmlFor="avatar-upload-drawer"
                  className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                >
                  {isUploading ? (
                    <Loader2 className="h-6 w-6 text-white animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5 text-white" />
                  )}
                </label>
                <input
                  id="avatar-upload-drawer"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                  disabled={isUploading}
                />
              </div>
              <div>
                <p className="font-medium">Foto de perfil</p>
                <p className="text-sm text-muted-foreground">JPG, PNG ou GIF. Máx 2MB</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="jobTitle" className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  Cargo / Função
                </Label>
                <Input
                  id="jobTitle"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Ex: Desenvolvedor Full Stack"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Conte um pouco sobre você..."
                  className="min-h-[80px] resize-none"
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {bio.length}/200
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  Localização
                </Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex: São Paulo, Brasil"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  E-mail
                </Label>
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted/50"
                />
              </div>

              <Separator />

              <p className="text-sm font-medium">Links e Redes Sociais</p>
              
              <div className="space-y-2">
                <Label htmlFor="website" className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-muted-foreground" />
                  Website
                </Label>
                <Input
                  id="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://seusite.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedin" className="flex items-center gap-2">
                  <Linkedin className="h-4 w-4 text-muted-foreground" />
                  LinkedIn
                </Label>
                <Input
                  id="linkedin"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/seu-perfil"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="github" className="flex items-center gap-2">
                  <Github className="h-4 w-4 text-muted-foreground" />
                  GitHub
                </Label>
                <Input
                  id="github"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/seu-usuario"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={updateProfileMutation.isPending}
              >
                {updateProfileMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar Alterações
              </Button>
            </form>

            <Separator />

            {/* Password Change */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4" />
                <p className="font-medium">Alterar Senha</p>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Senha Atual</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => {
                          setCurrentPassword(e.target.value);
                          setCurrentPasswordVerified(false);
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
                    <Button
                      type="button"
                      variant={currentPasswordVerified ? "outline" : "default"}
                      onClick={handleVerifyPassword}
                      disabled={isVerifyingPassword || currentPasswordVerified || !currentPassword}
                    >
                      {isVerifyingPassword ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : currentPasswordVerified ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        "Verificar"
                      )}
                    </Button>
                  </div>
                </div>

                {currentPasswordVerified && (
                  <>
                    <div className="space-y-2">
                      <Label>Nova Senha</Label>
                      <div className="relative">
                        <Input
                          type={showNewPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
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
                      <Label>Confirmar Nova Senha</Label>
                      <Input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirme a nova senha"
                      />
                      {confirmPassword && (
                        <div className="flex items-center gap-1 text-xs">
                          {newPassword === confirmPassword ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-green-500" />
                              <span className="text-green-500">Senhas coincidem</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 text-destructive" />
                              <span className="text-destructive">Senhas não coincidem</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    <Button
                      type="button"
                      onClick={handlePasswordChange}
                      disabled={isChangingPassword || newPassword !== confirmPassword || newPassword.length < 6}
                      className="w-full"
                    >
                      {isChangingPassword ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Lock className="mr-2 h-4 w-4" />
                      )}
                      Alterar Senha
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
