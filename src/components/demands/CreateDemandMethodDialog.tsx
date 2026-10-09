import { FileUp, PenLine, Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCreateDemandModal } from "@/contexts/CreateDemandContext";
import { ImportDemandsDialog } from "@/components/demands/ImportDemandsDialog";

const METHODS = [
  {
    key: "individual" as const,
    icon: PenLine,
    title: "Demanda individual",
    summary: "Você preenche cada campo, passo a passo.",
    points: [
      "Uma demanda por vez, com subdemandas se quiser",
      "Controle total de serviço, prazo, esforço e responsável",
      "Pode anexar arquivos e agendar reunião",
    ],
    best: "Melhor para pedidos pontuais",
    cta: "Criar manualmente",
  },
  {
    key: "import" as const,
    icon: FileUp,
    title: "A partir de documento",
    summary: "A IA lê o arquivo e monta as demandas para você.",
    points: [
      "Várias demandas de uma vez (até 50)",
      "P0/P1/P2 viram prioridade; esforço estimado pela IA",
      "Você revisa a lista e define os responsáveis antes de criar",
    ],
    best: "Melhor para briefings, atas e transcrições de reunião (PDF, Word, Excel)",
    cta: "Enviar documento",
  },
];

export function CreateDemandMethodDialog() {
  const { chooserOpen, setChooserOpen, chooseIndividual, chooseImport, importOpen, setImportOpen } = useCreateDemandModal();

  return (
    <>
      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nova demanda</DialogTitle>
            <DialogDescription>Escolha como quer criar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {METHODS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={m.key === "individual" ? chooseIndividual : chooseImport}
                className="group flex flex-col text-left rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <m.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground">{m.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{m.summary}</p>
                <ul className="mt-4 space-y-2 flex-1">
                  {m.points.map((p) => (
                    <li key={p} className="flex gap-2 text-sm text-foreground">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {p}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-muted-foreground">{m.best}</p>
                <span className="mt-3 inline-flex h-9 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-medium group-hover:bg-primary/90">
                  {m.cta}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <ImportDemandsDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
