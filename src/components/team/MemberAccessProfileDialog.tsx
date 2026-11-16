import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { TeamMember } from "@/hooks/useTeamMembers";
import { MemberKindBadge } from "./MemberKindBadge";
import { financeBlocked, hasFinance, type AccessProfile } from "@/lib/access/profiles";

interface Assignment {
  id: string;
  user_id: string;
  profile_id: string;
  all_projects: boolean;
  member_access_project_scope: { project_id: string }[];
}

const ERR: Record<string, string> = {
  CANNOT_GRANT_SELF: "Você não pode alterar o próprio acesso.",
  USER_NOT_IN_TEAM: "Essa pessoa não faz mais parte da equipe.",
  FORBIDDEN: "Só o dono da equipe pode alterar acessos.",
  FINANCE_NOT_ALLOWED_FOR_MEMBER: "Solicitantes e externos do cliente não podem ver o financeiro.",
};
const errMsg = (e: any) =>
  ERR[Object.keys(ERR).find((k) => String(e?.message).includes(k)) ?? ""] ?? "Não foi possível salvar.";

interface Props {
  teamId: string;
  member: TeamMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Per-member access profile editor, opened from the member card menu. */
export function MemberAccessProfileDialog({ teamId, member, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [allProjects, setAllProjects] = useState(true);
  const [scope, setScope] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const data = useQuery({
    queryKey: ["member-access-editor", teamId, member.user_id],
    enabled: open,
    queryFn: async () => {
      const [p, a, pr] = await Promise.all([
        supabase.from("access_profiles").select("*").or(`team_id.is.null,team_id.eq.${teamId}`).order("is_system", { ascending: false }).order("name"),
        supabase.from("member_access_profiles").select("id,user_id,profile_id,all_projects,member_access_project_scope(project_id)").eq("team_id", teamId).eq("user_id", member.user_id).maybeSingle(),
        supabase.from("projects").select("id,name").eq("team_id", teamId).order("name"),
      ]);
      if (p.error) throw p.error;
      if (a.error) throw a.error;
      if (pr.error) throw pr.error;
      return {
        profiles: p.data as AccessProfile[],
        assignment: (a.data as unknown as Assignment | null) ?? null,
        projects: pr.data as { id: string; name: string }[],
      };
    },
  });

  const profiles = data.data?.profiles ?? [];
  const noneId = profiles.find((p) => p.system_key === "none")?.id ?? null;
  const blocked = financeBlocked(member.role as string, member.member_kind);

  useEffect(() => {
    if (!open || !data.data) return;
    const a = data.data.assignment;
    setProfileId(a?.profile_id ?? noneId);
    setAllProjects(a?.all_projects ?? true);
    setScope(a?.member_access_project_scope.map((s) => s.project_id) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data.data]);

  const selectedProfile = useMemo(() => profiles.find((p) => p.id === profileId) ?? null, [profiles, profileId]);
  const isNone = !profileId || profileId === noneId;

  async function save() {
    if (!profileId) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("assign_access_profile", {
        _team_id: teamId,
        _user_id: member.user_id,
        _profile_id: profileId,
        _all_projects: allProjects,
        _project_ids: allProjects ? [] : scope,
      });
      if (error) throw error;
      toast.success("Perfil de acesso atualizado");
      await qc.invalidateQueries({ queryKey: ["access-profiles", teamId] });
      qc.invalidateQueries({ queryKey: ["member-access-editor", teamId] });
      qc.invalidateQueries({ queryKey: ["team-members", teamId] });
      qc.invalidateQueries({ queryKey: ["finance"] });
      onOpenChange(false);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" /> Perfil de acesso
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2.5">
          <Avatar className="h-9 w-9">
            <AvatarImage src={member.profile.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">{member.profile.full_name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate flex items-center gap-1.5">
              {member.profile.full_name}
              <MemberKindBadge kind={member.member_kind} />
            </p>
            <p className="text-[11px] text-muted-foreground truncate">{member.profile.email}</p>
          </div>
        </div>

        {data.isLoading ? (
          <div className="py-8 flex justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : data.isError ? (
          <p className="py-6 text-sm text-center text-muted-foreground">
            Não foi possível carregar os perfis.{" "}
            <button className="underline text-primary" onClick={() => data.refetch()}>Tentar de novo</button>
          </p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Perfil</label>
              <Select value={profileId ?? undefined} onValueChange={setProfileId}>
                <SelectTrigger className="h-9 text-sm" aria-label="Perfil de acesso">
                  <SelectValue placeholder="Sem acesso" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id} disabled={!!blocked && hasFinance(p.permissions)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {blocked && <p className="text-[11px] text-muted-foreground">{blocked}</p>}
              {selectedProfile?.description && (
                <p className="text-[11px] text-muted-foreground">{selectedProfile.description}</p>
              )}
            </div>

            <div className={cn("space-y-2", isNone && "opacity-50 pointer-events-none")}>
              <label className="text-xs font-medium text-muted-foreground">Projetos que essa pessoa acessa</label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={allProjects} onCheckedChange={(c) => setAllProjects(!!c)} />
                Todos os projetos
              </label>
              {!allProjects && (
                <div className="max-h-44 overflow-y-auto rounded-md border p-2 space-y-1">
                  {(data.data?.projects ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center">Nenhum projeto na equipe.</p>
                  ) : (
                    (data.data?.projects ?? []).map((p) => {
                      const on = scope.includes(p.id);
                      return (
                        <label key={p.id} className="flex items-center gap-2 py-1 text-sm cursor-pointer">
                          <Checkbox
                            checked={on}
                            onCheckedChange={() => setScope(on ? scope.filter((x) => x !== p.id) : [...scope, p.id])}
                          />
                          <span className="truncate">{p.name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || data.isLoading || data.isError || !profileId}>
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
