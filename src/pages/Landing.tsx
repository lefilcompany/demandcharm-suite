import { ArrowRight, BarChart3, BellRing, CalendarClock, CheckCircle2, ChevronRight, Clock3, Columns3, FileBarChart, FolderKanban, LockKeyhole, MessageCircle, Sparkles, Timer } from "lucide-react";
import { Link } from "react-router-dom";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DemoRequestForm } from "@/components/landing/DemoRequestForm";
import heroImage from "@/assets/landing/soma-lp-hero.png";
import kanbanLoop from "@/assets/landing/soma-kanban-loop.mp4.asset.json";
import logoDark from "@/assets/logo-soma-black.png";

const stats = [
  { value: "105+", label: "usuários mapeados" },
  { value: "70+", label: "tabelas operacionais" },
  { value: "4", label: "visões de demanda" },
  { value: "3", label: "canais de notificação" },
];

const pains = [
  "Escopo aprovado em um lugar, pedido real em outro.",
  "Cliente cobrando prazo sem enxergar fila, prioridade e responsável.",
  "Time apagando incêndio sem saber onde o tempo está sendo consumido.",
  "Relatório manual no fim do mês para provar o que foi entregue.",
];

const features = [
  {
    title: "Kanban por score de prioridade",
    description: "Solicitações, Backlog e etapas do quadro ordenadas por esforço, prioridade e tempo restante.",
    icon: Columns3,
  },
  {
    title: "Portal do solicitante",
    description: "Clientes acompanham pedidos, subdemandas, anexos e aprovações sem acessar a operação interna.",
    icon: MessageCircle,
  },
  {
    title: "Resumo IA com dados reais",
    description: "Leitura do quadro, entregas no prazo, gargalos e resumo por participante em poucos cliques.",
    icon: Sparkles,
  },
  {
    title: "Tempo e disponibilidade",
    description: "Timers simultâneos, férias, feriados, carga do time e bloqueio de alocação indisponível.",
    icon: Timer,
  },
  {
    title: "Notificações completas",
    description: "Avisos internos, e-mail e push para menções, prazos, responsáveis e mudanças importantes.",
    icon: BellRing,
  },
  {
    title: "Relatórios e snapshots",
    description: "Exportação de Kanban, projetos e resumo em PDF, CSV e planilhas para prestação de contas.",
    icon: FileBarChart,
  },
];

const workflow = [
  { title: "Receba solicitações", description: "Pedidos entram pelo fluxo certo, com descrição mínima, anexos e responsáveis claros." },
  { title: "Priorize sem reunião extra", description: "A fila combina urgência, esforço Fibonacci e prazo para mostrar o que vem primeiro." },
  { title: "Execute com transparência", description: "Kanban, calendário, lista e projetos mantêm time e cliente olhando para a mesma verdade." },
  { title: "Preste contas com IA", description: "Resumos por quadro e participante transformam execução em narrativa de valor." },
];

const audiences = ["Agências de marketing", "Times internos", "Operações com clientes", "Projetos recorrentes", "Gestores de conteúdo", "Equipes de performance"];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SEOHead
        title="SoMA+ - Gestão de demandas para marketing"
        description="Organize escopo, demandas, prazos, responsáveis, tempo e relatórios de marketing em uma plataforma feita para operações com clientes."
        path="/"
      />

      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <a href="#topo" className="flex items-center gap-3" aria-label="SoMA+">
            <img src={logoDark} alt="SoMA+" className="h-8 w-auto" />
          </a>
          <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
            <a className="transition-colors hover:text-foreground" href="#como-funciona">Como funciona</a>
            <a className="transition-colors hover:text-foreground" href="#recursos">Recursos</a>
            <a className="transition-colors hover:text-foreground" href="#demo">Demonstração</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild>
              <a href="#demo">Solicitar demo</a>
            </Button>
          </div>
        </div>
      </header>

      <main id="topo">
        <section className="relative overflow-hidden bg-sidebar text-sidebar-foreground">
          <div className="absolute inset-0 opacity-30">
            <img src={heroImage} alt="Interface do SoMA+" className="h-full w-full object-cover" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-sidebar via-sidebar/90 to-sidebar/45" />
          <div className="relative mx-auto grid min-h-[calc(100dvh-4rem)] max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.02fr_0.98fr] lg:px-8">
            <div className="max-w-3xl">
              <Badge className="mb-6 border-primary/30 bg-primary/15 text-primary" variant="outline">Sistema operacional para marketing</Badge>
              <h1 className="text-4xl font-black leading-tight tracking-normal sm:text-5xl lg:text-6xl">
                Transforme pedidos soltos em uma operação de marketing previsível.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-sidebar-foreground/80">
                O SoMA+ conecta escopo, solicitações, Kanban, tempo, aprovações, IA e relatórios para sua equipe entregar mais com menos ruído.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="shadow-[var(--shadow-primary)]">
                  <a href="#demo">Solicitar demonstração <ArrowRight className="h-4 w-4" /></a>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-sidebar-foreground/25 bg-sidebar-foreground/10 text-sidebar-foreground hover:bg-sidebar-foreground/20 hover:text-sidebar-foreground">
                  <a href="#recursos">Ver recursos</a>
                </Button>
              </div>
              <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {stats.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-sidebar-foreground/10 bg-sidebar-foreground/5 p-4 backdrop-blur-sm">
                    <p className="text-2xl font-black text-primary">{stat.value}</p>
                    <p className="mt-1 text-xs text-sidebar-foreground/65">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="rounded-xl border border-sidebar-foreground/10 bg-sidebar-foreground/8 p-3 shadow-2xl backdrop-blur-md">
                <video className="aspect-[16/10] w-full rounded-lg object-cover" autoPlay muted loop playsInline poster={heroImage}>
                  <source src={kanbanLoop.url} type="video/mp4" />
                </video>
              </div>
              <div className="absolute -bottom-6 left-8 right-8 rounded-xl border border-border bg-card p-5 text-card-foreground shadow-xl">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary"><BarChart3 className="h-5 w-5" /></div>
                  <div>
                    <p className="font-bold">Fila clara, prioridade defensável</p>
                    <p className="mt-1 text-sm text-muted-foreground">Score por esforço, prazo e prioridade para ordenar o que realmente importa.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-muted/40 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <Badge variant="outline" className="mb-4 border-primary/30 text-primary">O problema</Badge>
              <h2 className="text-3xl font-black leading-tight sm:text-4xl">Marketing não quebra por falta de ferramenta. Quebra por falta de escopo vivo.</h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                O SoMA+ foi criado para operações em que cada pedido tem contexto, prazo, responsável e impacto no contrato.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {pains.map((pain) => (
                <div key={pain} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <CheckCircle2 className="mb-4 h-5 w-5 text-primary" />
                  <p className="font-medium leading-7">{pain}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="outline" className="mb-4 border-primary/30 text-primary">Como funciona</Badge>
              <h2 className="text-3xl font-black leading-tight sm:text-4xl">Do pedido ao relatório, sem perder o fio da execução.</h2>
            </div>
            <div className="mt-12 grid gap-4 lg:grid-cols-4">
              {workflow.map((step, index) => (
                <div key={step.title} className="rounded-xl border border-border bg-card p-6 shadow-sm">
                  <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-black">0{index + 1}</div>
                  <h3 className="text-xl font-bold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="recursos" className="bg-muted/40 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <Badge variant="outline" className="mb-4 border-primary/30 text-primary">Recursos atuais</Badge>
              <h2 className="text-3xl font-black leading-tight sm:text-4xl">Uma camada única para demanda, entrega e prestação de contas.</h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                A plataforma já reúne recursos de operação, governança e inteligência que normalmente ficam espalhados em várias ferramentas.
              </p>
            </div>
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div key={feature.title} className="rounded-xl border border-border bg-card p-6 shadow-sm transition-transform hover:-translate-y-1">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-bold">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-2 lg:items-center">
            <div className="rounded-xl border border-border bg-card p-3 shadow-xl">
              <img src={heroImage} alt="Painel do SoMA+" className="aspect-[4/3] w-full rounded-lg object-cover object-left-top" />
            </div>
            <div>
              <Badge variant="outline" className="mb-4 border-primary/30 text-primary">Para quem vende entrega recorrente</Badge>
              <h2 className="text-3xl font-black leading-tight sm:text-4xl">Menos conversa perdida. Mais evidência de valor.</h2>
              <div className="mt-8 space-y-5">
                {[
                  { icon: FolderKanban, text: "Quadros por cliente, projeto, serviço e equipe." },
                  { icon: CalendarClock, text: "Recorrências semanais, quinzenais, mensais e anuais." },
                  { icon: Clock3, text: "Prazo original congelado e histórico de reagendamentos." },
                  { icon: LockKeyhole, text: "Papéis por equipe e por quadro, com acesso seguro." },
                ].map((item) => (
                  <div key={item.text} className="flex gap-4">
                    <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><item.icon className="h-4 w-4" /></div>
                    <p className="text-base leading-7 text-muted-foreground">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-sidebar px-4 py-20 text-sidebar-foreground sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <div className="max-w-2xl">
                <Badge className="mb-4 border-primary/30 bg-primary/15 text-primary" variant="outline">Perfis ideais</Badge>
                <h2 className="text-3xl font-black leading-tight sm:text-4xl">Feito para quem precisa controlar promessa, execução e relacionamento.</h2>
              </div>
              <Button asChild variant="outline" className="border-sidebar-foreground/25 bg-sidebar-foreground/10 text-sidebar-foreground hover:bg-sidebar-foreground/20 hover:text-sidebar-foreground">
                <a href="#demo">Conversar com vendas <ChevronRight className="h-4 w-4" /></a>
              </Button>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {audiences.map((audience) => (
                <div key={audience} className="rounded-xl border border-sidebar-foreground/10 bg-sidebar-foreground/5 p-5 font-semibold">
                  {audience}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="demo" className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div className="lg:sticky lg:top-24">
              <Badge variant="outline" className="mb-4 border-primary/30 text-primary">Sem tabela de preços</Badge>
              <h2 className="text-3xl font-black leading-tight sm:text-4xl">Solicite uma demonstração adaptada ao seu fluxo.</h2>
              <p className="mt-4 text-lg leading-8 text-muted-foreground">
                Em vez de escolher um plano no escuro, mostre como sua operação funciona hoje. O time SoMA+ apresenta o melhor caminho para sua equipe.
              </p>
              <div className="mt-8 rounded-xl border border-border bg-muted/50 p-5">
                <p className="font-bold">Na demonstração você vê:</p>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />Como organizar quadros, clientes e serviços.</li>
                  <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />Como priorizar fila com score e esforço.</li>
                  <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />Como gerar relatórios e resumos para clientes.</li>
                </ul>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-xl sm:p-8">
              <DemoRequestForm />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <img src={logoDark} alt="SoMA+" className="h-8 w-auto self-start" />
          <p>SoMA+ — Sistema operacional de marketing para equipes orientadas por escopo.</p>
        </div>
      </footer>
    </div>
  );
}
