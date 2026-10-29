import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMemberProfiles, useFinanceMutation } from "@/hooks/useProjectFinance";
import { MEMBER_KIND_LABEL, type MemberKind } from "@/lib/finance/attribution";

export function MemberProfilesPanel({ teamId, members, canManage }: { teamId: string; members: { user_id: string; name: string }[]; canManage: boolean }) {
  const { toast } = useToast();
  const { data: profiles = [] } = useMemberProfiles(teamId);
  const [form, setForm] = useState<{ user: string; kind: MemberKind | ""; from: string }>({ user: "", kind: "", from: new Date().toISOString().substring(0, 7) });

  const current = (uid: string) => profiles.find((p: any) => p.user_id === uid && !p.valid_to);
  const save = useFinanceMutation(async () => {
    const from = `${form.from}-01`;
    const prev = current(form.user);
    if (prev) {
      const d = new Date(`${from}T00:00:00Z`); d.setUTCDate(0);
      const end = d.toISOString().substring(0, 10);
      const { error: e1 } = await supabase.from("finance_member_profiles").update({ valid_to: end < prev.valid_from ? prev.valid_from : end }).eq("id", prev.id);
      if (e1) throw e1;
    }
    const { error } = await supabase.from("finance_member_profiles").insert({ team_id: teamId, user_id: form.user, kind: form.kind as MemberKind, valid_from: from });
    if (error) throw error;
  });

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-4 xl:col-span-2">
      <div>
        <h3 className="font-semibold">Vínculo dos membros</h3>
        <p className="text-sm text-muted-foreground">Interno, externo do cliente ou prestador, com início. O papel no quadro não define o vínculo. Sem vínculo, a pessoa aparece como "não classificada" — nunca como custo zero.</p>
      </div>
      {canManage && (
        <form className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined, {
          onSuccess: () => { toast({ title: "Vínculo salvo" }); setForm({ ...form, user: "", kind: "" }); },
          onError: (err: any) => toast({ title: String(err?.message).includes("OVERLAP") ? "Já existe vínculo nesse período." : "Não foi possível salvar.", variant: "destructive" }) }); }}>
          <Select value={form.user} onValueChange={(v) => setForm({ ...form, user: v })}><SelectTrigger><SelectValue placeholder="Pessoa" /></SelectTrigger>
            <SelectContent>{members.map((m) => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}</SelectContent></Select>
          <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as MemberKind })}><SelectTrigger><SelectValue placeholder="Vínculo" /></SelectTrigger>
            <SelectContent>{Object.entries(MEMBER_KIND_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
          <Input type="month" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} required aria-label="A partir de" />
          <Button type="submit" disabled={!form.user || !form.kind || save.isPending}>Salvar vínculo</Button>
        </form>
      )}
      <ul className="divide-y text-sm max-h-64 overflow-y-auto">
        {members.map((m) => {
          const p = current(m.user_id);
          return (
            <li key={m.user_id} className="flex justify-between gap-2 py-2">
              <span className="truncate">{m.name}</span>
              <span className={p ? "" : "text-destructive"}>{p ? `${MEMBER_KIND_LABEL[p.kind as MemberKind]} · desde ${p.valid_from.substring(0, 7).split("-").reverse().join("/")}` : "Não classificado"}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
