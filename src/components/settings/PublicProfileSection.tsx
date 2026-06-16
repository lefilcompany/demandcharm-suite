import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import { SectionShell } from "./SectionShell";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2, Save, Palette } from "lucide-react";
import {
  PROFILE_FIELDS,
  GROUP_LABELS,
  DEFAULT_VISIBILITY,
  BANNER_GRADIENTS,
  type ProfileFieldKey,
  type ProfileFieldDef,
} from "@/lib/profileCustomization";
import { ProfilePreview } from "@/components/profile/ProfilePreview";

export function PublicProfileSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [vis, setVis] = useState<Record<ProfileFieldKey, boolean>>({
    ...DEFAULT_VISIBILITY,
  });
  const [gradient, setGradient] = useState<string>("soma-orange");
  const [historyPublic, setHistoryPublic] = useState(false);

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

  useEffect(() => {
    if (!profile) return;
    const raw = (profile as any).profile_visibility || {};
    const merged = { ...DEFAULT_VISIBILITY };
    for (const k of Object.keys(merged) as ProfileFieldKey[]) {
      if (typeof raw[k] === "boolean") merged[k] = raw[k];
    }
    setVis(merged);
    setGradient((profile as any).banner_gradient || "soma-orange");
    setHistoryPublic(Boolean((profile as any).is_demand_history_public));
  }, [profile]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase
        .from("profiles")
        .update({
          profile_visibility: vis,
          banner_gradient: gradient,
          is_demand_history_public: historyPublic,
        } as any)
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["user-profile"] });
      toast.success("Perfil público atualizado!");
    },
    onError: (e) => toast.error("Erro ao salvar", { description: getErrorMessage(e) }),
  });

  const toggle = (k: ProfileFieldKey) =>
    setVis((p) => ({ ...p, [k]: !p[k] }));

  const groups = PROFILE_FIELDS.reduce((acc, f) => {
    (acc[f.group] ||= []).push(f);
    return acc;
  }, {} as Record<ProfileFieldDef["group"], ProfileFieldDef[]>);

  if (isLoading) {
    return (
      <SectionShell icon={Eye} title="Perfil público" description="Carregando...">
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </SectionShell>
    );
  }

  return (
    <SectionShell
      icon={Eye}
      title="Perfil público"
      description="Escolha o que aparece quando outros usuários visitam seu perfil"
      action={
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar alterações
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-5 min-w-0">
          {/* History privacy */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              {historyPublic ? (
                <Eye className="h-4 w-4 text-success" />
              ) : (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <p className="text-sm font-medium">Histórico de demandas</p>
                <p className="text-xs text-muted-foreground">
                  {historyPublic
                    ? "Visível para outros usuários"
                    : "Apenas você pode ver seu histórico"}
                </p>
              </div>
            </div>
            <Switch checked={historyPublic} onCheckedChange={setHistoryPublic} />
          </div>

          <Separator />

          {/* Banner gradient picker */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" /> Banner padrão (quando sem imagem)
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {BANNER_GRADIENTS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGradient(g.id)}
                  className={`relative h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    gradient === g.id
                      ? "border-primary ring-2 ring-primary/30"
                      : "border-transparent hover:border-border"
                  }`}
                >
                  <div className={`absolute inset-0 ${g.className}`} />
                  <span className="relative z-10 flex items-end justify-start h-full p-1.5 text-[10px] font-medium text-white drop-shadow">
                    {g.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Visibility toggles by group */}
          {(Object.keys(groups) as ProfileFieldDef["group"][]).map((g) => (
            <div key={g} className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {GROUP_LABELS[g]}
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {groups[g].map((f) => (
                  <label
                    key={f.key}
                    htmlFor={`vis-${f.key}`}
                    className="flex items-center justify-between rounded-md border bg-card p-2.5 cursor-pointer hover:bg-muted/40 transition"
                  >
                    <span className="text-sm">{f.label}</span>
                    <Switch
                      id={`vis-${f.key}`}
                      checked={vis[f.key]}
                      onCheckedChange={() => toggle(f.key)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Live preview */}
        <div className="lg:sticky lg:top-4 self-start">
          <ProfilePreview profile={profile} visibility={vis} gradient={gradient} />
        </div>
      </div>
    </SectionShell>
  );
}
