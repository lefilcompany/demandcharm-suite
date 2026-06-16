import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { SectionShell } from "./SectionShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  User, Camera, Loader2, Save, Mail, Phone, MapPin, Briefcase,
  Link as LinkIcon, Github, Linkedin, CheckCircle2,
} from "lucide-react";

export function ProfileSection() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bio, setBio] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [stateField, setStateField] = useState("");
  const [website, setWebsite] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || "");
    setAvatarUrl(profile.avatar_url || "");
    setBio((profile as any).bio || "");
    setJobTitle((profile as any).job_title || "");
    setLocation((profile as any).location || "");
    setPhone((profile as any).phone || "");
    setCity((profile as any).city || "");
    setStateField((profile as any).state || "");
    setWebsite((profile as any).website || "");
    setLinkedinUrl((profile as any).linkedin_url || "");
    setGithubUrl((profile as any).github_url || "");
  }, [profile]);

  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("profiles").update(data as any).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast.success("Perfil atualizado!");
    },
    onError: (e) => toast.error("Erro ao salvar", { description: getErrorMessage(e) }),
  });

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return toast.error("Selecione uma imagem válida");
    if (file.size > 2 * 1024 * 1024) return toast.error("Máximo de 2MB");

    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(publicUrl);
      // persist immediately so sidebar refreshes
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Foto atualizada!");
    } catch (err: any) {
      toast.error("Erro no upload", { description: getErrorMessage(err) });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = () => {
    if (!fullName.trim()) return toast.error("Nome é obrigatório");
    updateMutation.mutate({
      full_name: fullName.trim(),
      avatar_url: avatarUrl || null,
      bio: bio.trim() || null,
      job_title: jobTitle.trim() || null,
      location: location.trim() || null,
      phone: phone.trim() || null,
      city: city.trim() || null,
      state: stateField.trim() || null,
      website: website.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      github_url: githubUrl.trim() || null,
    });
  };

  const getInitials = (n: string) => n.split(" ").map((x) => x[0]).join("").toUpperCase().slice(0, 2);

  return (
    <SectionShell
      icon={User}
      title="Informações Pessoais"
      description="Atualize seus dados pessoais"
      action={
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar alterações
        </Button>
      }
    >
      {/* Avatar row */}
      <div className="flex items-center gap-4">
        <div className="relative group">
          <Avatar className="h-16 w-16 border">
            <AvatarImage src={avatarUrl} alt={fullName} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary">
              {fullName ? getInitials(fullName) : <User className="h-6 w-6" />}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            {isUploading ? <Loader2 className="h-4 w-4 text-white animate-spin" /> : <Camera className="h-4 w-4 text-white" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>
        <div>
          <p className="font-medium text-sm">Foto de perfil</p>
          <p className="text-xs text-muted-foreground">JPG, PNG ou GIF. Máx 2MB</p>
        </div>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label htmlFor="fullName" className="text-xs uppercase tracking-wide text-muted-foreground">Nome Completo</Label>
        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-xs uppercase tracking-wide text-muted-foreground">E-mail</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="email" value={user?.email || ""} disabled className="pl-9 bg-muted/40" />
        </div>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-primary" />
          E-mail verificado · Não pode ser alterado
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="phone" className="text-xs uppercase tracking-wide text-muted-foreground">Telefone</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" className="pl-9" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="state" className="text-xs uppercase tracking-wide text-muted-foreground">Estado</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input id="state" value={stateField} onChange={(e) => setStateField(e.target.value)} placeholder="Selecione" className="pl-9" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city" className="text-xs uppercase tracking-wide text-muted-foreground">Cidade</Label>
          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Selecione" />
        </div>
      </div>

      <Separator />

      <div className="space-y-1.5">
        <Label htmlFor="jobTitle" className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5" /> Cargo / Função
        </Label>
        <Input id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Ex: Desenvolvedor Full Stack" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bio" className="text-xs uppercase tracking-wide text-muted-foreground">Bio</Label>
        <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Conte um pouco sobre você..." className="min-h-[80px] resize-none" maxLength={200} />
        <p className="text-xs text-muted-foreground text-right">{bio.length}/200</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="location" className="text-xs uppercase tracking-wide text-muted-foreground">Localização</Label>
        <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ex: São Paulo, Brasil" />
      </div>

      <Separator />

      <p className="text-sm font-medium">Links e Redes Sociais</p>

      <div className="space-y-1.5">
        <Label htmlFor="website" className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <LinkIcon className="h-3.5 w-3.5" /> Website
        </Label>
        <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://seusite.com" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="linkedin" className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Linkedin className="h-3.5 w-3.5" /> LinkedIn
        </Label>
        <Input id="linkedin" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/seu-perfil" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="github" className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
          <Github className="h-3.5 w-3.5" /> GitHub
        </Label>
        <Input id="github" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/seu-usuario" />
      </div>
    </SectionShell>
  );
}
