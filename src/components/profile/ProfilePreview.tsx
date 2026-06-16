import { AvatarWithStatus } from "@/components/AvatarWithStatus";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Trophy, Calendar, MapPin, Link as LinkIcon, Github, Linkedin,
  CheckCircle2, Clock, MessageSquare, Briefcase, Users, LayoutGrid,
  TrendingUp, Activity, Award, History, Eye,
} from "lucide-react";
import {
  getBannerGradient,
  type ProfileFieldKey,
} from "@/lib/profileCustomization";

interface ProfilePreviewProps {
  profile: any;
  visibility: Record<ProfileFieldKey, boolean>;
  gradient: string;
}

/**
 * Compact, faithful visual preview of how the public profile will look
 * to other users — driven by current visibility toggles in the form.
 */
export function ProfilePreview({ profile, visibility, gradient }: ProfilePreviewProps) {
  const v = (k: ProfileFieldKey) => visibility[k];
  const banner = getBannerGradient(gradient);
  const initials = (profile?.full_name || "?")
    .split(" ").map((s: string) => s[0]).join("").toUpperCase().slice(0, 2);

  const StatCard = ({ icon: Icon, label, value, color = "text-primary" }: any) => (
    <div className="rounded-md border bg-card p-2 flex items-center gap-2">
      <Icon className={`h-3.5 w-3.5 ${color}`} />
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground truncate">{label}</p>
        <p className="text-xs font-semibold truncate">{value}</p>
      </div>
    </div>
  );

  const Indicator = ({ icon: Icon, label, value }: any) => (
    <div className="flex items-center justify-between text-[11px] py-1">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3 w-3" /> {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  );

  const showStats =
    v("statDemands") || v("statDelivered") || v("statTime") || v("statComments");
  const showIndicators =
    v("statTeams") || v("statBoards") || v("statCompletion") || v("statRecent");
  const showSections =
    v("demandHistory") || v("achievements") || v("teams") || v("boards");

  return (
    <Card className="overflow-hidden shadow-md">
      {/* Preview header chip */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/40">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Eye className="h-3 w-3" /> Pré-visualização do perfil público
        </div>
        <span className="text-[10px] text-muted-foreground">como outros veem</span>
      </div>

      {/* Banner */}
      <div className="relative w-full" style={{ aspectRatio: "4 / 1" }}>
        {v("banner") && profile?.banner_url ? (
          <>
            <img src={profile.banner_url} alt="Banner" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </>
        ) : (
          <div className={`absolute inset-0 ${banner.className}`}>
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          </div>
        )}
        {v("level") && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/40 backdrop-blur-md rounded-full px-2 py-0.5 border border-white/10">
            <Trophy className="h-3 w-3 text-yellow-400" />
            <span className="text-white text-[10px] font-bold">Nível 4</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="relative px-4 pb-4">
        <div className="absolute -top-8 left-4">
          <div className="relative">
            <AvatarWithStatus
              src={profile?.avatar_url || undefined}
              fallback={initials}
              className="h-16 w-16 border-4 border-background shadow-lg"
              size="lg"
              showStatus={false}
            />
            {v("level") && (
              <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold border-2 border-background">
                4
              </div>
            )}
          </div>
        </div>

        <div className="pt-10 pl-20">
          <h3 className="text-base font-bold leading-tight">{profile?.full_name || "Seu nome"}</h3>
          {v("jobTitle") && profile?.job_title && (
            <p className="text-primary text-xs font-medium">{profile.job_title}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Membro</span>
            {v("location") && profile?.location && (
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {profile.location}</span>
            )}
          </div>
          {v("bio") && profile?.bio && (
            <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">{profile.bio}</p>
          )}

          {/* Social */}
          {(v("website") || v("github") || v("linkedin")) && (
            <div className="flex items-center gap-1.5 mt-2">
              {v("website") && profile?.website && (
                <span className="h-6 w-6 rounded border flex items-center justify-center"><LinkIcon className="h-3 w-3" /></span>
              )}
              {v("github") && profile?.github_url && (
                <span className="h-6 w-6 rounded border flex items-center justify-center"><Github className="h-3 w-3" /></span>
              )}
              {v("linkedin") && profile?.linkedin_url && (
                <span className="h-6 w-6 rounded border flex items-center justify-center"><Linkedin className="h-3 w-3" /></span>
              )}
            </div>
          )}
        </div>

        {/* XP */}
        {v("level") && (
          <div className="mt-3 bg-muted/50 rounded-md p-2">
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="flex items-center gap-1 font-medium">
                <TrendingUp className="h-3 w-3 text-primary" /> Próximo nível
              </span>
              <span className="text-muted-foreground">120 / 200 XP</span>
            </div>
            <Progress value={60} className="h-1.5" />
          </div>
        )}

        {/* Stats */}
        {showStats && (
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {v("statDemands") && <StatCard icon={Briefcase} label="Demandas" value="42" color="text-blue-400" />}
            {v("statDelivered") && <StatCard icon={CheckCircle2} label="Entregues" value="31" color="text-emerald-400" />}
            {v("statTime") && <StatCard icon={Clock} label="Tempo" value="86h" color="text-amber-400" />}
            {v("statComments") && <StatCard icon={MessageSquare} label="Comentários" value="158" color="text-pink-400" />}
          </div>
        )}

        {/* Indicators */}
        {showIndicators && (
          <div className="mt-3 rounded-md border bg-card p-2 divide-y divide-border/60">
            {v("statTeams") && <Indicator icon={Users} label="Equipes" value="3" />}
            {v("statBoards") && <Indicator icon={LayoutGrid} label="Quadros" value="7" />}
            {v("statCompletion") && <Indicator icon={TrendingUp} label="Taxa de conclusão" value="74%" />}
            {v("statRecent") && <Indicator icon={Activity} label="Atividade (30d)" value="42" />}
          </div>
        )}

        {/* Sections (tabs) */}
        {showSections && (
          <div className="mt-3">
            <div className="flex items-center gap-1 border-b">
              {v("demandHistory") && (
                <span className="px-2 py-1 text-[11px] font-medium border-b-2 border-primary text-primary flex items-center gap-1">
                  <History className="h-3 w-3" /> Histórico
                </span>
              )}
              {v("achievements") && (
                <span className="px-2 py-1 text-[11px] text-muted-foreground flex items-center gap-1">
                  <Award className="h-3 w-3" /> Conquistas
                </span>
              )}
              {v("teams") && (
                <span className="px-2 py-1 text-[11px] text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" /> Equipes
                </span>
              )}
              {v("boards") && (
                <span className="px-2 py-1 text-[11px] text-muted-foreground flex items-center gap-1">
                  <LayoutGrid className="h-3 w-3" /> Quadros
                </span>
              )}
            </div>
            <div className="p-2 space-y-1">
              <div className="h-6 rounded bg-muted/60" />
              <div className="h-6 rounded bg-muted/40" />
              <div className="h-6 rounded bg-muted/30" />
            </div>
          </div>
        )}

        {!showStats && !showIndicators && !showSections && (
          <div className="mt-3 rounded-md border border-dashed p-3 text-center text-[11px] text-muted-foreground">
            Nenhum bloco visível. Ative opções acima para mostrar conteúdo.
          </div>
        )}

        {/* Hidden fields hint */}
        <div className="mt-3 flex flex-wrap gap-1">
          {!v("banner") && <Badge variant="outline" className="text-[9px] py-0 h-4">Banner oculto</Badge>}
          {!v("level") && <Badge variant="outline" className="text-[9px] py-0 h-4">Nível oculto</Badge>}
          {!v("bio") && <Badge variant="outline" className="text-[9px] py-0 h-4">Bio oculta</Badge>}
        </div>
      </div>
    </Card>
  );
}
