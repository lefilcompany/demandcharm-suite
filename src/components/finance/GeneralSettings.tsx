import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Pencil, Plus, Star, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TeamDefaultsPanel } from "@/components/finance/TeamDefaultsPanel";
import { formatPct } from "@/lib/finance/engine";
import { useFinancePresets, type FinancePreset } from "@/hooks/useFinancePresets";

const FIELDS = [
  { k: "tax_rate", label: "Impostos %" },
  { k: "variable_rate", label: "Custos variáveis %" },
  { k: "margin_target", label: "Meta de margem %" },
  { k: "max_discount", label: "Desconto máximo %" },
] as const;
type Draft = { id?: string; name: string; description: string } & Record<(typeof FIELDS)[number]["k"], string>;
const toDraft = (p?: FinancePreset, copy = false): Draft => ({
  id: copy ? undefined : p?.id, name: p ? (copy ? `${p.name} (cópia)` : p.name) : "", description: p?.description ?? "",
  tax_rate: p ? String(+(p.tax_rate * 100).toFixed(2)) : "", variable_rate: p ? String(+(p.variable_rate * 100).toFixed(2)) : "",
  margin_target: p ? String(+(p.margin_target * 100).toFixed(2)) : "", max_discount: p ? String(+(p.max_discount * 100).toFixed(2)) : "",
});

export function GeneralSettings({ teamId, canEdit }: { teamId: string; canEdit: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const presets = useFinancePresets(teamId);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["finance-presets", teamId] });
  const fail = () => toast({ title: "Não foi possível salvar.", variant: "destructive" });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft?.name.trim()) return;
    const p = (v: string) => Number(v || 0) / 100;
    const vals = { tax_rate: p(draft.tax_rate), variable_rate: p(draft.variable_rate), margin_target: p(draft.margin_target), max_discount: p(draft.max_discount) };
    if (Object.values(vals).some((v) => v < 0 || v >= 1)) return toast({ title: "Use percentuais entre 0 e 99,99%.", variant: "destructive" });
    if (vals.tax_rate + vals.variable_rate + vals.margin_target >= 1) return toast({ title: "Impostos, custos e meta somam 100% ou mais.", variant: "destructive" });
    setBusy(true);
    const row = { ...vals, name: draft.name.trim(), description: draft.description.trim() || null, updated_at: new Date().toISOString() };
    const { error } = draft.id
      ? await supabase.from("finance_config_presets").update(row).eq("id", draft.id)
      : await supabase.from("finance_config_presets").insert({ ...row, team_id: teamId, created_by: user!.id, is_default: (presets.data ?? []).length === 0 });
    setBusy(false);
    if (error) return fail();
    toast({ title: "Perfil salvo" });
    setDraft(null);
    refresh();
  };

  const makeDefault = async (p: FinancePreset) => {
    const cur = presets.data?.find((x) => x.is_default);
    if (cur) { const r = await supabase.from("finance_config_presets").update({ is_default: false }).eq("id", cur.id); if (r.error) return fail(); }
    const { error } = await supabase.from("finance_config_presets").update({ is_default: true }).eq("id", p.id);
    if (error) fail();
    refresh();
  };
  const archive = async (p: FinancePreset) => {
    const { error } = await supabase.from("finance_config_presets").update({ archived_at: new Date().toISOString(), is_default: false }).eq("id", p.id);
    if (error) fail();
    refresh();
  };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <div>
            <h3 className="text-sm font-semibold">Perfis de configuração</h3>
            <p className="text-xs text-muted-foreground">Escolhidos ao criar um projeto novo. Os valores são copiados para o projeto; editar o perfil depois não muda projetos existentes.</p>
          </div>
          {canEdit && <Button size="sm" onClick={() => setDraft(toDraft())}><Plus className="mr-1 h-4 w-4" />Novo perfil</Button>}
        </header>
        <div className="grid gap-3 border-t p-4 sm:grid-cols-2 xl:grid-cols-3 sm:p-5">
          {presets.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {presets.isError && <p className="text-sm text-destructive">Não foi possível carregar os perfis. <button className="underline" onClick={() => presets.refetch()}>Tentar novamente</button></p>}
          {presets.data?.length === 0 && <p className="text-sm text-muted-foreground">Nenhum perfil criado ainda.</p>}
          {presets.data?.map((p) => (
            <article key={p.id} className="flex flex-col gap-3 rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  {p.description && <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>}
                </div>
                {p.is_default && <Badge variant="secondary" className="shrink-0">Padrão</Badge>}
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {FIELDS.map((f) => (<div key={f.k} className="flex justify-between gap-2"><dt className="text-muted-foreground">{f.label.replace(" %", "")}</dt><dd className="tabular-nums font-medium">{formatPct(p[f.k])}</dd></div>))}
              </dl>
              {canEdit && (
                <div className="flex flex-wrap gap-1 border-t pt-2">
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setDraft(toDraft(p))}><Pencil className="mr-1 h-3.5 w-3.5" />Editar</Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setDraft(toDraft(p, true))}><Copy className="mr-1 h-3.5 w-3.5" />Duplicar</Button>
                  {!p.is_default && <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => makeDefault(p)}><Star className="mr-1 h-3.5 w-3.5" />Tornar padrão</Button>}
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-muted-foreground" onClick={() => archive(p)}><Archive className="mr-1 h-3.5 w-3.5" />Arquivar</Button>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <fieldset disabled={!canEdit} className="min-w-0">
        <TeamDefaultsPanel teamId={teamId} />
      </fieldset>
      {!canEdit && <p className="text-xs text-muted-foreground">Somente o gestor financeiro pode alterar estas configurações.</p>}

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader><DialogTitle>{draft?.id ? "Editar perfil" : "Novo perfil"}</DialogTitle></DialogHeader>
          {draft && (
            <form onSubmit={save} className="space-y-3">
              <div className="space-y-1.5"><Label htmlFor="preset-name">Nome *</Label><Input id="preset-name" value={draft.name} maxLength={80} onChange={(e) => setDraft({ ...draft, name: e.target.value })} autoFocus /></div>
              <div className="space-y-1.5"><Label htmlFor="preset-desc">Descrição</Label><Input id="preset-desc" value={draft.description} maxLength={200} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                {FIELDS.map((f) => (
                  <div key={f.k} className="space-y-1.5"><Label htmlFor={`preset-${f.k}`}>{f.label}</Label>
                    <Input id={`preset-${f.k}`} inputMode="decimal" value={draft[f.k]} onChange={(e) => setDraft({ ...draft, [f.k]: e.target.value.replace(",", ".").replace(/[^0-9.]/g, "") })} placeholder="0" /></div>
                ))}
              </div>
              <DialogFooter><Button type="button" variant="outline" onClick={() => setDraft(null)}>Cancelar</Button><Button type="submit" disabled={busy || !draft.name.trim()}>Salvar</Button></DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
