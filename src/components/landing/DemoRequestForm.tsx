import { useMemo, useState } from "react";
import { Loader2, Send, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  name: z.string().trim().min(2, "Informe seu nome").max(120),
  email: z.string().trim().email("Informe um e-mail válido").max(255),
  company: z.string().trim().min(2, "Informe a empresa").max(160),
  phone: z.string().trim().max(40).optional(),
  role: z.string().trim().max(120).optional(),
  teamSize: z.string().trim().max(80).optional(),
  message: z.string().trim().max(1200).optional(),
});

type FormState = z.infer<typeof schema>;

const initialState: FormState = {
  name: "",
  email: "",
  company: "",
  phone: "",
  role: "",
  teamSize: "",
  message: "",
};

export function DemoRequestForm() {
  const [form, setForm] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = useMemo(() => {
    return form.name.trim().length >= 2 && schema.safeParse(form).success;
  }, [form]);

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        name: fieldErrors.name?.[0],
        email: fieldErrors.email?.[0],
        company: fieldErrors.company?.[0],
        phone: fieldErrors.phone?.[0],
        role: fieldErrors.role?.[0],
        teamSize: fieldErrors.teamSize?.[0],
        message: fieldErrors.message?.[0],
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("request-demo", {
        body: { ...parsed.data, sourcePath: window.location.pathname },
      });

      if (error) throw error;

      setSent(true);
      setForm(initialState);
      toast.success("Solicitação enviada. Nossa equipe vai entrar em contato.");
    } catch (error) {
      console.error("request-demo failed:", error);
      toast.error("Não foi possível enviar agora. Tente novamente em instantes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h3 className="text-xl font-bold text-foreground">Solicitação recebida</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Enviamos seus dados para o time comercial da SoMA+. Em breve alguém entra em contato para agendar a demonstração.
        </p>
        <Button className="mt-5" variant="outline" onClick={() => setSent(false)}>
          Enviar outra solicitação
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome" error={errors.name}>
          <Input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder="Seu nome" autoComplete="name" />
        </Field>
        <Field label="E-mail" error={errors.email}>
          <Input value={form.email} onChange={(event) => updateField("email", event.target.value)} placeholder="voce@empresa.com" type="email" autoComplete="email" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Empresa" error={errors.company}>
          <Input value={form.company} onChange={(event) => updateField("company", event.target.value)} placeholder="Nome da empresa" autoComplete="organization" />
        </Field>
        <Field label="Telefone" error={errors.phone}>
          <Input value={form.phone} onChange={(event) => updateField("phone", event.target.value)} placeholder="(00) 00000-0000" type="tel" autoComplete="tel" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cargo" error={errors.role}>
          <Input value={form.role} onChange={(event) => updateField("role", event.target.value)} placeholder="Ex.: Gestor de Marketing" autoComplete="organization-title" />
        </Field>
        <Field label="Tamanho do time" error={errors.teamSize}>
          <Select value={form.teamSize} onValueChange={(value) => updateField("teamSize", value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1-5 pessoas">1-5 pessoas</SelectItem>
              <SelectItem value="6-15 pessoas">6-15 pessoas</SelectItem>
              <SelectItem value="16-50 pessoas">16-50 pessoas</SelectItem>
              <SelectItem value="Mais de 50 pessoas">Mais de 50 pessoas</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="O que você quer organizar primeiro?" error={errors.message}>
        <Textarea
          value={form.message}
          onChange={(event) => updateField("message", event.target.value)}
          placeholder="Conte rapidamente sobre seu fluxo de demandas, clientes ou equipe."
          className="min-h-28"
        />
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting || !canSubmit}>
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Solicitar demonstração
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Usaremos seus dados apenas para responder à solicitação de demonstração.
      </p>
    </form>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
