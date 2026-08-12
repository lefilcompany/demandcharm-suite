import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useDuplicateDemand } from "@/hooks/useDuplicateDemand";
import { useNavigate } from "react-router-dom";
import { DuplicateSuccessModal } from "@/components/DuplicateSuccessModal";

interface DuplicateDemandDialogProps {
  demandId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toDateInput(iso: string | null): string {
  return iso ? iso.substring(0, 10) : "";
}

function isOverdue(iso: string | null): boolean {
  if (!iso) return false;
  const today = new Date().toISOString().substring(0, 10);
  return iso.substring(0, 10) < today;
}

function daysBetween(fromDate: string, toDate: string): number {
  const a = new Date(`${fromDate}T00:00:00`).getTime();
  const b = new Date(`${toDate}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso.substring(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function DuplicateDemandDialog({ demandId, open, onOpenChange }: DuplicateDemandDialogProps) {
  const navigate = useNavigate();
  const duplicate = useDuplicateDemand();
  const [withAttachments, setWithAttachments] = useState(false);
  const [newDate, setNewDate] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["duplicate-demand-preview", demandId],
    queryFn: async () => {
      const [{ data: demand, error }, { data: subs }, { data: atts }] = await Promise.all([
        supabase.from("demands").select("id, title, due_date").eq("id", demandId).maybeSingle(),
        supabase
          .from("demands")
          .select("id, title, due_date")
          .eq("parent_demand_id", demandId)
          .eq("archived", false),
        supabase
          .from("demand_attachments")
          .select("id", { count: "exact", head: false })
          .eq("demand_id", demandId)
          .is("interaction_id", null),
      ]);
      if (error) throw error;
      return {
        demand: demand as { id: string; title: string; due_date: string | null } | null,
        subdemands: (subs || []) as { id: string; title: string; due_date: string | null }[],
        attachmentCount: (atts || []).length,
      };
    },
    enabled: open && !!demandId,
  });

  const parentOverdue = isOverdue(data?.demand?.due_date ?? null);
  const overdueSubs = useMemo(
    () => (data?.subdemands || []).filter((s) => isOverdue(s.due_date)),
    [data?.subdemands]
  );
  const needsNewDate = parentOverdue || overdueSubs.length > 0;

  useEffect(() => {
    if (open) {
      setWithAttachments(false);
      setNewDate("");
    }
  }, [open, demandId]);

  const handleDuplicate = () => {
    if (!data?.demand) return;
    if (needsNewDate && !newDate) {
      toast.error("Defina uma nova data de entrega para continuar.");
      return;
    }

    let parentNewDue: string | null = null;
    let shift: number | null = null;

    if (parentOverdue && data.demand.due_date) {
      parentNewDue = `${newDate}T12:00:00.000Z`;
      shift = daysBetween(toDateInput(data.demand.due_date), newDate);
    }

    const subdemandDueDates: Record<string, string> = {};
    for (const sub of overdueSubs) {
      if (shift !== null && sub.due_date) {
        subdemandDueDates[sub.id] = shiftDate(sub.due_date, shift);
      } else {
        subdemandDueDates[sub.id] = `${newDate}T12:00:00.000Z`;
      }
    }

    duplicate.mutate(
      {
        demandId,
        newDueDate: parentNewDue,
        subdemandDueDates,
        copyAttachments: withAttachments,
      },
      {
        onSuccess: (res) => {
          if (res.attachmentsFailed > 0) {
            toast.warning(`Demanda duplicada, mas ${res.attachmentsFailed} anexo(s) não puderam ser copiados.`);
          } else {
            toast.success("Demanda duplicada com sucesso!", {
              action: {
                label: "Abrir cópia",
                onClick: () => navigate(`/demands/${res.newDemandId}`),
              },
            });
          }
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error(err.message || "Erro ao duplicar demanda");
        },
      }
    );
  };

  const subCount = data?.subdemands.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-4 w-4 text-[#F28705]" />
            Duplicar demanda
          </DialogTitle>
          <DialogDescription>
            Uma nova demanda será criada no mesmo quadro, com os mesmos dados e responsáveis.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !data?.demand ? (
          <div className="py-8 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground mb-1">Título da cópia</p>
              <p className="text-sm font-medium break-words">[CÓPIA] {data.demand.title}</p>
            </div>

            <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
              <li>Descrição, prioridade, serviço, etapa e prazo</li>
              <li>Responsável e seguidores</li>
              <li>Checklist (itens copiados como não concluídos)</li>
              <li>Dependências</li>
              {subCount > 0 && <li>{subCount} subdemanda(s)</li>}
            </ul>

            {needsNewDate && (
              <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-xs text-destructive">
                    {parentOverdue
                      ? "O prazo desta demanda está vencido."
                      : "Há subdemandas com prazo vencido."}{" "}
                    Defina uma nova data de entrega para a cópia.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="dup-due-date" className="text-xs">Nova data de entrega</Label>
                  <Input
                    id="dup-due-date"
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="dup-attachments"
                checked={withAttachments}
                onCheckedChange={(v) => setWithAttachments(v === true)}
              />
              <Label htmlFor="dup-attachments" className="text-sm font-normal cursor-pointer">
                Copiar anexos
                {data.attachmentCount > 0 && (
                  <span className="text-muted-foreground"> ({data.attachmentCount} nesta demanda)</span>
                )}
              </Label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={duplicate.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleDuplicate} disabled={duplicate.isPending || isLoading || !data?.demand}>
            {duplicate.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Duplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
