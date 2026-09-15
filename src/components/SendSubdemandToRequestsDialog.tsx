import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useSendSubdemandToRequests } from "@/hooks/useSubdemands";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";

interface SendSubdemandToRequestsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demandId: string;
  demandTitle: string;
  onSuccess?: () => void;
}

export function SendSubdemandToRequestsDialog({
  open,
  onOpenChange,
  demandId,
  demandTitle,
  onSuccess,
}: SendSubdemandToRequestsDialogProps) {
  const send = useSendSubdemandToRequests();

  const handleConfirm = async () => {
    try {
      await send.mutateAsync({ demandId });
      toast.success("Enviada para Solicitações. Agora ela aguarda aprovação.");
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(getErrorMessage(err) || "Não foi possível enviar para Solicitações");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enviar para Solicitações?</AlertDialogTitle>
          <AlertDialogDescription>
            "{demandTitle}" sairá do quadro e passará a aguardar aprovação na seção de
            Solicitações, mantendo título, descrição, prioridade e serviço. A subdemanda vai para
            a lixeira e pode ser recuperada por 30 dias.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={send.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={send.isPending}
            className="bg-[#F28705] text-white hover:bg-[#D95204]"
          >
            {send.isPending ? "Enviando..." : "Enviar para Solicitações"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
