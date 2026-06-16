import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import logoSoma from "@/assets/logo-soma.png";

export default function PrivacyPolicy() {
  return (
    <>
      <SEOHead title="Política de Privacidade" description="Conheça a Política de Privacidade do SoMA e como protegemos seus dados." path="/privacy-policy" />
      <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-4">
          <Link to="/auth" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <img src={logoSoma} alt="SoMA" className="h-7" />
          <h1 className="text-lg font-semibold">Política de Privacidade</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 space-y-8">
        <p className="text-sm text-muted-foreground">Última atualização: 03 de março de 2026</p>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">1. Introdução</h2>
          <p className="text-muted-foreground leading-relaxed">
            A <strong className="text-foreground">SoMA+</strong> é uma plataforma de gestão de demandas e tarefas para equipes. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">2. Dados Coletados</h2>
          <p className="text-muted-foreground leading-relaxed">Coletamos os seguintes dados pessoais:</p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li><strong className="text-foreground">Dados de cadastro:</strong> nome completo, endereço de e-mail, telefone, foto de perfil.</li>
            <li><strong className="text-foreground">Dados de localização:</strong> estado e cidade (obtidos via API do IBGE), utilizados para contextualizar seu perfil.</li>
            <li><strong className="text-foreground">Dados de autenticação via Google:</strong> ao optar pelo login com Google, recebemos seu nome, e-mail e foto de perfil associados à sua conta Google.</li>
            <li><strong className="text-foreground">Dados de uso:</strong> interações com a plataforma, demandas criadas, arquivos anexados, registros de tempo e atividades dentro das equipes.</li>
            <li><strong className="text-foreground">Dados técnicos:</strong> endereço IP, tipo de navegador, sistema operacional e dados de cookies.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">3. Finalidade do Tratamento</h2>
          <p className="text-muted-foreground leading-relaxed">Utilizamos seus dados para:</p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Criar e gerenciar sua conta na plataforma;</li>
            <li>Permitir a gestão de equipes, quadros, demandas e tarefas;</li>
            <li>Enviar notificações relacionadas às suas atividades (e-mail e push);</li>
            <li>Gerar relatórios e métricas de produtividade;</li>
            <li>Melhorar a experiência do usuário e a funcionalidade da plataforma;</li>
            <li>Cumprir obrigações legais e regulatórias.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Armazenamento e Segurança</h2>
          <p className="text-muted-foreground leading-relaxed">
            Seus dados são armazenados em infraestrutura segura na nuvem, com criptografia em trânsito (TLS/SSL) e em repouso. Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados contra acesso não autorizado, perda ou destruição.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">5. Compartilhamento de Dados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Seus dados pessoais <strong className="text-foreground">não são vendidos</strong> a terceiros. Podemos compartilhar dados apenas:
          </p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li>Com membros da sua equipe, conforme as permissões configuradas na plataforma;</li>
            <li>Com prestadores de serviço essenciais (processamento de pagamentos, envio de e-mails);</li>
            <li>Quando exigido por lei ou ordem judicial.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">6. Cookies</h2>
          <p className="text-muted-foreground leading-relaxed">
            Utilizamos cookies e armazenamento local para manter sua sessão ativa, salvar preferências (idioma, tema) e melhorar a experiência de navegação. Você pode gerenciar cookies através das configurações do seu navegador.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">7. Seus Direitos (LGPD)</h2>
          <p className="text-muted-foreground leading-relaxed">Você tem direito a:</p>
          <ul className="list-disc pl-6 space-y-1 text-muted-foreground">
            <li><strong className="text-foreground">Acesso:</strong> solicitar uma cópia dos seus dados pessoais;</li>
            <li><strong className="text-foreground">Correção:</strong> atualizar dados incompletos ou incorretos;</li>
            <li><strong className="text-foreground">Eliminação:</strong> solicitar a exclusão dos seus dados pessoais;</li>
            <li><strong className="text-foreground">Portabilidade:</strong> receber seus dados em formato estruturado;</li>
            <li><strong className="text-foreground">Revogação do consentimento:</strong> retirar o consentimento a qualquer momento.</li>
          </ul>
          <p className="text-muted-foreground leading-relaxed">
            Para exercer seus direitos, entre em contato pelo e-mail: <a href="mailto:privacidade@soma.app" className="text-primary hover:underline">privacidade@soma.app</a>
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">8. Retenção de Dados</h2>
          <p className="text-muted-foreground leading-relaxed">
            Seus dados serão mantidos enquanto sua conta estiver ativa ou conforme necessário para cumprir obrigações legais. Após a exclusão da conta, os dados serão removidos em até 30 dias, exceto quando a retenção for exigida por lei.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">9. Alterações nesta Política</h2>
          <p className="text-muted-foreground leading-relaxed">
            Podemos atualizar esta política periodicamente. Notificaremos sobre mudanças significativas por e-mail ou aviso na plataforma. O uso contínuo da SoMA+ após as alterações constitui aceitação da política atualizada.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">10. Contato</h2>
          <p className="text-muted-foreground leading-relaxed">
            Em caso de dúvidas sobre esta Política de Privacidade ou sobre o tratamento dos seus dados, entre em contato:<br />
            <strong className="text-foreground">E-mail:</strong>{" "}
            <a href="mailto:privacidade@soma.app" className="text-primary hover:underline">privacidade@soma.app</a>
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
