import { useState } from "react";
import { useAdminCoupons, useCreateCoupon, useToggleCoupon, useUpdateCoupon, useCouponRedemptions } from "@/hooks/admin/useAdminCoupons";
import { usePlans } from "@/hooks/usePlans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Eye, Ticket, Copy, Check, LayoutGrid, List, Calendar, Pencil, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TrialCoupon } from "@/hooks/admin/useAdminCoupons";
import { SEOHead } from "@/components/SEOHead";

function generateCode() {
  return "SOMA-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

type CouponForm = {
  code: string;
  plan_id: string;
  trial_days: number;
  max_uses: number;
  description: string;
  expires_at: string;
};

const emptyForm = (): CouponForm => ({
  code: generateCode(),
  plan_id: "",
  trial_days: 15,
  max_uses: 1,
  description: "",
  expires_at: "",
});

export default function AdminCoupons() {
  const { data: coupons, isLoading } = useAdminCoupons();
  const { data: plans } = usePlans();
  const createCoupon = useCreateCoupon();
  const toggleCoupon = useToggleCoupon();
  const updateCoupon = useUpdateCoupon();

  const [view, setView] = useState<"cards" | "list">("cards");
  const [showCreate, setShowCreate] = useState(false);
  const [showRedemptions, setShowRedemptions] = useState<string | null>(null);
  const [editingCoupon, setEditingCoupon] = useState<TrialCoupon | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [propagate, setPropagate] = useState(false);

  const [form, setForm] = useState<CouponForm>(emptyForm());
  const [editForm, setEditForm] = useState<CouponForm>(emptyForm());

  const handleCreate = async () => {
    if (!form.code || !form.plan_id) {
      toast.error("Preencha o código e selecione um plano");
      return;
    }
    if (!form.trial_days || form.trial_days < 1) {
      toast.error("Os dias de teste devem ser no mínimo 1");
      return;
    }
    if (!form.max_uses || form.max_uses < 1) {
      toast.error("O máximo de usos deve ser no mínimo 1");
      return;
    }
    try {
      await createCoupon.mutateAsync({
        code: form.code.toUpperCase(),
        plan_id: form.plan_id,
        trial_days: form.trial_days,
        max_uses: form.max_uses,
        description: form.description || undefined,
        expires_at: form.expires_at || null,
      });
      toast.success("Cupom criado com sucesso!");
      setShowCreate(false);
      setForm(emptyForm());
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar cupom");
    }
  };

  const openEdit = (coupon: TrialCoupon) => {
    setEditingCoupon(coupon);
    setEditForm({
      code: coupon.code,
      plan_id: coupon.plan_id,
      trial_days: coupon.trial_days,
      max_uses: coupon.max_uses,
      description: coupon.description || "",
      expires_at: coupon.expires_at ? coupon.expires_at.split("T")[0] : "",
    });
    setPropagate(false);
  };

  const handleEditSubmit = () => {
    if (!editForm.plan_id) {
      toast.error("Selecione um plano");
      return;
    }
    if (!editForm.trial_days || editForm.trial_days < 1) {
      toast.error("Os dias de teste devem ser no mínimo 1");
      return;
    }
    if (!editForm.max_uses || editForm.max_uses < 1) {
      toast.error("O máximo de usos deve ser no mínimo 1");
      return;
    }
    if (editingCoupon && editForm.max_uses < editingCoupon.times_used) {
      toast.error(`O máximo de usos não pode ser menor que ${editingCoupon.times_used} (já resgatados)`);
      return;
    }
    setShowConfirm(true);
  };

  const confirmEdit = async () => {
    if (!editingCoupon) return;
    setShowConfirm(false);
    try {
      const result = await updateCoupon.mutateAsync({
        coupon_id: editingCoupon.id,
        plan_id: editForm.plan_id,
        trial_days: editForm.trial_days,
        max_uses: editForm.max_uses,
        description: editForm.description || null,
        expires_at: editForm.expires_at || null,
        propagate,
      });
      const affected = result?.affected_teams ?? 0;
      if (propagate && affected > 0) {
        toast.success(`Cupom atualizado! ${affected} equipe(s) afetada(s) com as novas configurações.`);
      } else {
        toast.success("Cupom atualizado com sucesso!");
      }
      setEditingCoupon(null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao atualizar cupom");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <SEOHead title="Admin - Cupons" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cupons</h1>
          <p className="text-muted-foreground text-sm">Gerencie cupons de teste grátis</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <Button variant={view === "cards" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setView("cards")}>
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setView("list")}>
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Cupom
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
        </div>
      ) : !coupons?.length ? (
        <div className="p-16 text-center text-muted-foreground rounded-2xl border-2 border-dashed border-border">
          <Ticket className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">Nenhum cupom criado ainda</p>
          <p className="text-sm mt-1">Crie seu primeiro cupom para começar</p>
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {coupons.map((c) => (
            <CouponCard
              key={c.id}
              coupon={c}
              onToggle={(checked) => toggleCoupon.mutate({ id: c.id, is_active: checked })}
              onViewRedemptions={() => setShowRedemptions(c.id)}
              onEdit={() => openEdit(c)}
            />
          ))}
        </div>
      ) : (
        <CouponListView
          coupons={coupons}
          onToggle={(id, checked) => toggleCoupon.mutate({ id, is_active: checked })}
          onViewRedemptions={(id) => setShowRedemptions(id)}
          onEdit={(c) => openEdit(c)}
        />
      )}

      {/* Create Dialog */}
      <CouponFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        title="Criar Cupom"
        form={form}
        setForm={setForm}
        plans={plans}
        onSubmit={handleCreate}
        isPending={createCoupon.isPending}
        submitLabel="Criar Cupom"
        showCodeField
      />

      {/* Edit Dialog */}
      <CouponFormDialog
        open={!!editingCoupon}
        onOpenChange={(open) => { if (!open) setEditingCoupon(null); }}
        title="Editar Cupom"
        form={editForm}
        setForm={setEditForm}
        plans={plans}
        onSubmit={handleEditSubmit}
        isPending={updateCoupon.isPending}
        submitLabel="Salvar Alterações"
        showCodeField={false}
        minMaxUses={editingCoupon?.times_used}
        extraContent={
          editingCoupon && editingCoupon.times_used > 0 ? (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-accent/50 border border-accent">
              <AlertTriangle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Este cupom já foi resgatado {editingCoupon.times_used} vez(es).
                </p>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="propagate"
                    checked={propagate}
                    onCheckedChange={(c) => setPropagate(!!c)}
                  />
                  <label htmlFor="propagate" className="text-sm cursor-pointer">
                    Propagar alterações para equipes que já resgataram
                  </label>
                </div>
              </div>
            </div>
          ) : null
        }
      />

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração</AlertDialogTitle>
            <AlertDialogDescription>
              {propagate
                ? "As alterações serão aplicadas ao cupom e também atualizarão as assinaturas das equipes que já resgataram este cupom (plano e dias de teste). Deseja continuar?"
                : "As alterações serão aplicadas apenas ao cupom. Equipes que já resgataram não serão afetadas. Deseja continuar?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEdit}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Redemptions Dialog */}
      <RedemptionsDialog couponId={showRedemptions} onClose={() => setShowRedemptions(null)} />
    </div>
  );
}

/* ─── Shared Form Dialog ─── */

function CouponFormDialog({
  open,
  onOpenChange,
  title,
  form,
  setForm,
  plans,
  onSubmit,
  isPending,
  submitLabel,
  showCodeField,
  minMaxUses,
  extraContent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  form: CouponForm;
  setForm: React.Dispatch<React.SetStateAction<CouponForm>>;
  plans: any[] | undefined;
  onSubmit: () => void;
  isPending: boolean;
  submitLabel: string;
  showCodeField: boolean;
  minMaxUses?: number;
  extraContent?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SEOHead title="Admin - Cupons" />
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {showCodeField && (
            <div className="space-y-2">
              <Label>Código</Label>
              <div className="flex gap-2">
                <Input
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                  className="font-mono"
                />
                <Button variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, code: generateCode() }))}>
                  Gerar
                </Button>
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label>Plano</Label>
            <Select value={form.plan_id} onValueChange={(v) => setForm((f) => ({ ...f, plan_id: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o plano" />
              </SelectTrigger>
              <SelectContent>
                {plans?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dias de teste</Label>
              <Input
                type="number"
                min={0}
                value={form.trial_days === 0 ? "" : form.trial_days}
                onChange={(e) => setForm((f) => ({ ...f, trial_days: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Máx. usos {minMaxUses ? <span className="text-xs text-muted-foreground">(mín: {minMaxUses})</span> : null}</Label>
              <Input
                type="number"
                min={minMaxUses || 0}
                value={form.max_uses === 0 ? "" : form.max_uses}
                onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value === "" ? 0 : parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Data de expiração (opcional)</Label>
            <Input
              type="date"
              value={form.expires_at}
              onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição interna (opcional)</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Ex: Campanha Black Friday"
            />
          </div>
          {extraContent}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={onSubmit} disabled={isPending}>
            {isPending ? "Salvando..." : submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Coupon Card ─── */

function CouponCard({
  coupon,
  onToggle,
  onViewRedemptions,
  onEdit,
}: {
  coupon: TrialCoupon;
  onToggle: (checked: boolean) => void;
  onViewRedemptions: () => void;
  onEdit: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isExpired = coupon.expires_at && new Date(coupon.expires_at) < new Date();
  const isMaxed = coupon.times_used >= coupon.max_uses;
  const isUsable = coupon.is_active && !isExpired && !isMaxed;
  const isManuallyDeactivated = !coupon.is_active && !isMaxed;

  const copyCode = () => {
    navigator.clipboard.writeText(coupon.code);
    setCopied(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = () => {
    if (isMaxed) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
          <SEOHead title="Admin - Cupons" />
          <AlertTriangle className="h-3 w-3" />
          Esgotado
        </span>
      );
    }
    if (isExpired) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
          <SEOHead title="Admin - Cupons" />
          Expirado
        </span>
      );
    }
    if (!coupon.is_active) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
          <SEOHead title="Admin - Cupons" />
          Inativo
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
        <SEOHead title="Admin - Cupons" />
        Ativo
      </span>
    );
  };

  return (
    <div className="relative group">
      <SEOHead title="Admin - Cupons" />
      <div
        className={`relative overflow-hidden rounded-2xl border-2 transition-all duration-300 ${
          isUsable
            ? "border-primary/30 bg-card hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10"
            : "border-border bg-muted/30"
        }`}
      >
        {/* Top accent bar */}
        <div className={`h-1.5 w-full ${isUsable ? "bg-gradient-to-r from-primary via-accent to-primary" : isMaxed ? "bg-destructive/40" : "bg-muted-foreground/20"}`} />

        {/* Ticket cutouts */}
        <div className="absolute left-0 top-[4.5rem] -translate-x-1/2 w-6 h-6 rounded-full bg-background border-2 border-r-0 border-border z-10" />
        <div className="absolute right-0 top-[4.5rem] translate-x-1/2 w-6 h-6 rounded-full bg-background border-2 border-l-0 border-border z-10" />

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <Ticket className={`h-5 w-5 shrink-0 ${isUsable ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`font-bold text-lg tracking-wide font-mono truncate ${isUsable ? "text-foreground" : "text-muted-foreground"}`}>{coupon.code}</span>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copyCode}>
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {coupon.description && (
            <p className="text-xs text-muted-foreground mb-3 line-clamp-1 pl-7">{coupon.description}</p>
          )}
          {!coupon.description && <div className="mb-3" />}

          {/* Dashed divider */}
          <div className="border-t-2 border-dashed border-border my-3 mx-[-1.25rem] px-5" />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 text-center mb-4">
            <div>
              <p className={`text-2xl font-black ${isUsable ? "text-foreground" : "text-muted-foreground"}`}>{coupon.trial_days}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">dias</p>
            </div>
            <div>
              <p className={`text-2xl font-black ${isMaxed ? "text-destructive" : "text-foreground"}`}>
                {coupon.times_used}<span className="text-sm font-normal text-muted-foreground">/{coupon.max_uses}</span>
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">usos</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground truncate">{(coupon.plans as any)?.name ?? "—"}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">plano</p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div className="flex items-center gap-2">
              {getStatusBadge()}
              {/* Only show toggle if NOT maxed — maxed coupons must be edited to increase uses */}
              {!isMaxed && (
                <Switch
                  checked={coupon.is_active}
                  onCheckedChange={onToggle}
                  className="scale-75 origin-left"
                />
              )}
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={onViewRedemptions}>
              <Eye className="h-3 w-3 mr-1" />
              Resgates
            </Button>
          </div>

          {/* Maxed hint */}
          {isMaxed && (
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              Para reativar, edite o cupom e aumente o máximo de usos
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── List View ─── */

function CouponListView({
  coupons,
  onToggle,
  onViewRedemptions,
  onEdit,
}: {
  coupons: TrialCoupon[];
  onToggle: (id: string, checked: boolean) => void;
  onViewRedemptions: (id: string) => void;
  onEdit: (coupon: TrialCoupon) => void;
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card">
      <SEOHead title="Admin - Cupons" />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Código</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Dias</TableHead>
            <TableHead>Usos</TableHead>
            <TableHead>Expira em</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {coupons.map((c) => (
            <TableRow key={c.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-sm bg-muted px-2 py-0.5 rounded">{c.code}</code>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyCode(c.code, c.id)}>
                    {copiedId === c.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </TableCell>
              <TableCell>{(c.plans as any)?.name ?? "—"}</TableCell>
              <TableCell>{c.trial_days} dias</TableCell>
              <TableCell>{c.times_used}/{c.max_uses}</TableCell>
              <TableCell>
                {c.expires_at
                  ? format(new Date(c.expires_at), "dd/MM/yyyy", { locale: ptBR })
                  : "Sem expiração"}
              </TableCell>
              <TableCell>
                {c.times_used >= c.max_uses ? (
                  <span className="text-xs font-medium text-destructive">Esgotado</span>
                ) : (
                  <Switch checked={c.is_active} onCheckedChange={(checked) => onToggle(c.id, checked)} />
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(c)}>
                    <Pencil className="h-4 w-4 mr-1" />
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onViewRedemptions(c.id)}>
                    <Eye className="h-4 w-4 mr-1" />
                    Resgates
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ─── Redemptions Dialog ─── */

function RedemptionsDialog({ couponId, onClose }: { couponId: string | null; onClose: () => void }) {
  const { data, isLoading } = useCouponRedemptions(couponId);

  return (
    <Dialog open={!!couponId} onOpenChange={() => onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resgates do Cupom</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !data?.length ? (
          <p className="text-center text-muted-foreground py-6">Nenhum resgate ainda</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipe</TableHead>
                <TableHead>Resgatado por</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell>{r.teams?.name ?? "—"}</TableCell>
                  <TableCell>{r.profiles?.full_name ?? "—"}</TableCell>
                  <TableCell>{format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
