import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, KeyRound } from "lucide-react";

const ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/finance-api-v1`;

/** Team owner creates a read-only key for the external finance panel; the key is shown only once. */
export function FinanceApiKeyCard({ teamId }: { teamId: string }) {
  const { toast } = useToast();
  const [name, setName] = useState("Painel financeiro");
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_finance_api_key", { _team_id: teamId, _name: name });
    setBusy(false);
    if (error) return toast({ title: String(error.message).includes("FORBIDDEN") ? "Só o dono da equipe cria essa chave." : "Não foi possível criar a chave.", variant: "destructive" });
    setKey(data as string);
  };
  const copy = (v: string) => navigator.clipboard.writeText(v).then(() => toast({ title: "Copiado" }));

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5 space-y-3 xl:col-span-2">
      <div className="flex items-start gap-3">
        <KeyRound className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <h3 className="font-semibold">Chave do painel externo</h3>
          <p className="text-sm text-muted-foreground">Permite que o painel financeiro externo leia os resultados por projeto e mês. Só leitura, só desta equipe, e cada acesso fica registrado.</p>
        </div>
      </div>
      {key ? (
        <div className="space-y-2 text-sm">
          <p className="text-primary font-medium">Copie agora: a chave não será mostrada de novo.</p>
          <div className="flex gap-2"><Input readOnly value={key} className="font-mono text-xs" /><Button variant="outline" size="icon" aria-label="Copiar chave" onClick={() => copy(key)}><Copy className="h-4 w-4" /></Button></div>
          <div className="flex gap-2"><Input readOnly value={`${ENDPOINT}?competence=AAAA-MM`} className="font-mono text-xs" /><Button variant="outline" size="icon" aria-label="Copiar endereço" onClick={() => copy(ENDPOINT)}><Copy className="h-4 w-4" /></Button></div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome da chave" className="h-9" />
          <Button size="sm" className="h-9" onClick={create} disabled={busy}>Criar chave</Button>
        </div>
      )}
    </section>
  );
}
