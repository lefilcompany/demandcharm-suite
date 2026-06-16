import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import logoSoma from "@/assets/logo-soma.png";

export default function TermsOfService() {
  return (
    <>
      <SEOHead title="Termos de Serviço" description="Leia os Termos de Serviço do SoMA - Sistema Operacional de Marketing." path="/terms-of-service" />
      <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Link to="/auth" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <img src={logoSoma} alt="SoMA" className="h-7" />
          <h1 className="text-lg font-semibold">Termos de Serviço</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 space-y-8">
        <p className="text-sm text-muted-foreground">Última atualização: 03 de março de 2026</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Aceitação dos Termos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Ao acessar ou utilizar a plataforma <strong className="text-foreground">SoMA+</strong>, você concorda com estes Termos de Serviço. Se você não concordar com qualquer parte destes termos, não utilize a plataforma. A SoMA+ é uma ferramenta de gestão de demandas e tarefas para equipes, disponível como aplicação web e PWA.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Elegibilidade</h2>
          <p className="text-muted-foreground leading-relaxed">
            Para utilizar a SoMA+, você deve ter pelo menos 16 anos de idade. Ao criar uma conta, você declara que as informações fornecidas são verdadeiras e que possui capacidade legal para celebrar este acordo.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Conta do Usuário</h2>
          <p className="text-muted-foreground leading-relaxed">Ao criar uma conta, você se responsabiliza por:</p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Manter a confidencialidade de suas credenciais de acesso;</li>
            <li>Todas as atividades realizadas com sua conta;</li>
            <li>Notificar imediatamente qualquer uso não autorizado;</li>
            <li>Manter seus dados de perfil atualizados.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Uso Aceitável</h2>
          <p className="text-muted-foreground leading-relaxed">Ao utilizar a SoMA+, você concorda em <strong className="text-foreground">não</strong>:</p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Violar leis ou regulamentos aplicáveis;</li>
            <li>Enviar conteúdo ilegal, ofensivo, difamatório ou que viole direitos de terceiros;</li>
            <li>Tentar acessar dados de outros usuários sem autorização;</li>
            <li>Utilizar a plataforma para spam, phishing ou atividades fraudulentas;</li>
            <li>Realizar engenharia reversa ou tentar comprometer a segurança da plataforma;</li>
            <li>Compartilhar credenciais de acesso com terceiros.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Equipes e Colaboração</h2>
          <p className="text-muted-foreground leading-relaxed">
            A SoMA+ permite criar e gerenciar equipes. O criador da equipe (administrador) é responsável por gerenciar membros, permissões e conteúdo. Dados e demandas criados dentro de uma equipe são acessíveis aos membros conforme as permissões configuradas.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Planos e Pagamentos</h2>
          <p className="text-muted-foreground leading-relaxed">
            A SoMA+ oferece planos gratuitos e pagos. Funcionalidades, limites de uso e recursos variam conforme o plano contratado. Pagamentos são processados por meio de provedores terceirizados de pagamento. Cancelamentos e reembolsos seguem as condições descritas no momento da contratação.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Propriedade Intelectual</h2>
          <p className="text-muted-foreground leading-relaxed">
            A marca SoMA+, seu design, código-fonte, logotipos e demais elementos visuais são de propriedade exclusiva dos desenvolvedores da plataforma. O conteúdo criado por você (demandas, notas, arquivos) permanece de sua propriedade. Ao utilizar a plataforma, você nos concede uma licença limitada para armazenar e processar esse conteúdo conforme necessário para a prestação do serviço.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Disponibilidade do Serviço</h2>
          <p className="text-muted-foreground leading-relaxed">
            Nos esforçamos para manter a SoMA+ disponível 24 horas por dia, 7 dias por semana. No entanto, não garantimos disponibilidade ininterrupta. O serviço pode ser temporariamente indisponível para manutenção, atualizações ou por motivos de força maior, sem que isso gere direito a indenização.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">9. Limitação de Responsabilidade</h2>
          <p className="text-muted-foreground leading-relaxed">
            A SoMA+ é fornecida "como está". Não nos responsabilizamos por danos indiretos, incidentais ou consequenciais decorrentes do uso ou impossibilidade de uso da plataforma, incluindo perda de dados, lucros cessantes ou interrupção de negócios, exceto nos casos previstos em lei.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">10. Suspensão e Encerramento</h2>
          <p className="text-muted-foreground leading-relaxed">
            Reservamo-nos o direito de suspender ou encerrar sua conta caso haja violação destes Termos de Serviço, uso abusivo ou atividade que comprometa a segurança da plataforma. Você pode encerrar sua conta a qualquer momento através das configurações do seu perfil.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">11. Alterações nos Termos</h2>
          <p className="text-muted-foreground leading-relaxed">
            Podemos modificar estes Termos de Serviço a qualquer momento. Alterações significativas serão comunicadas por e-mail ou aviso na plataforma. O uso contínuo da SoMA+ após a publicação das alterações constitui aceitação dos novos termos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">12. Legislação Aplicável</h2>
          <p className="text-muted-foreground leading-relaxed">
            Estes Termos de Serviço são regidos pelas leis da República Federativa do Brasil. Qualquer controvérsia será dirimida no foro da comarca do domicílio do usuário, conforme previsto no Código de Defesa do Consumidor.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">13. Contato</h2>
          <p className="text-muted-foreground leading-relaxed">
            Dúvidas sobre estes Termos de Serviço podem ser enviadas para:<br />
            <strong className="text-foreground">E-mail:</strong>{" "}
            <a href="mailto:contato@soma.app" className="text-primary hover:underline">contato@soma.app</a>
          </p>
        </section>

        <div className="pt-6 border-t">
          <Link to="/auth" className="text-sm text-primary hover:underline">
            ← Voltar para o login
          </Link>
        </div>
      </main>
    </div>
    </>
  );
}
