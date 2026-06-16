import { useState } from "react";

import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { PlanCard } from "@/components/PlanCard";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { usePlans, Plan } from "@/hooks/usePlans";
import { useTeamSubscription } from "@/hooks/useSubscription";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useCreateCheckout } from "@/hooks/useCheckout";
import { toast } from "sonner";
import { Loader2, Sparkles, Zap, Shield, Clock } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

export default function Pricing() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const { data: plans, isLoading: plansLoading } = usePlans();
  const { selectedTeamId } = useSelectedTeam();
  const { data: subscription } = useTeamSubscription(selectedTeamId);
  const createCheckout = useCreateCheckout();

  const handleSelectPlan = async (plan: Plan) => {
    if (plan.slug === "enterprise") {
      window.open("mailto:contato@soma.com?subject=Interesse no Plano Enterprise", "_blank");
      return;
    }

    if (!selectedTeamId) {
      toast.error(t("pricing.selectTeamFirst"));
      navigate("/teams");
      return;
    }

    try {
      const checkoutUrl = await createCheckout.mutateAsync({
        planSlug: plan.slug,
        teamId: selectedTeamId,
      });
      
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error("Checkout error:", error);
      toast.error(t("pricing.checkoutError"));
    }
  };

  const currentPlanSlug = subscription?.plan?.slug;

  const highlights = [
    { icon: Zap, label: "Ativação instantânea", description: "Comece a usar em segundos" },
    { icon: Shield, label: "Dados seguros", description: "Criptografia de ponta a ponta" },
    { icon: Clock, label: "Suporte 24/7", description: "Sempre quando precisar" },
  ];

  const faqs = [
    {
      question: t("pricing.faq.changePlan.question"),
      answer: t("pricing.faq.changePlan.answer"),
    },
    {
      question: t("pricing.faq.trial.question"),
      answer: t("pricing.faq.trial.answer"),
    },
    {
      question: t("pricing.faq.payment.question"),
      answer: t("pricing.faq.payment.answer"),
    },
    {
      question: t("pricing.faq.cancel.question"),
      answer: t("pricing.faq.cancel.answer"),
    },
    {
      question: t("pricing.faq.limits.question"),
      answer: t("pricing.faq.limits.answer"),
    },
  ];

  if (plansLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <SEOHead title="Planos e Preços" path="/pricing" />
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground animate-pulse">Carregando planos...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    
    <div className="min-h-screen">
      {/* Hero Section with Gradient Background */}
      <div className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background pb-8">
        {/* Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-20 -left-20 w-60 h-60 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>

        <div className="container max-w-7xl py-6 relative">
          <PageBreadcrumb items={[{ label: t("pricing.title") }]} />

          {/* Header */}
          <div className="text-center space-y-6 py-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
              <Sparkles className="h-4 w-4" />
              <span>Planos flexíveis para cada necessidade</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">
              {t("pricing.title")}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {t("pricing.subtitle")}
            </p>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <Label
                htmlFor="billing-toggle"
                className={`text-base transition-colors cursor-pointer ${billingPeriod === "monthly" ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t("pricing.monthly")}
              </Label>
              <div className="relative">
                <Switch
                  id="billing-toggle"
                  checked={billingPeriod === "yearly"}
                  onCheckedChange={(checked) => setBillingPeriod(checked ? "yearly" : "monthly")}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label
                  htmlFor="billing-toggle"
                  className={`text-base transition-colors cursor-pointer ${billingPeriod === "yearly" ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t("pricing.yearly")}
                </Label>
                <Badge className="bg-gradient-to-r from-success to-emerald-500 text-white border-0 shadow-lg shadow-success/25 animate-pulse">
                  {t("pricing.yearlyDiscount")}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="container max-w-7xl -mt-4">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans?.map((plan, index) => (
            <div 
              key={plan.id} 
              className="animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <PlanCard
                plan={plan}
                isCurrentPlan={currentPlanSlug === plan.slug}
                isPopular={plan.slug === "profissional"}
                onSelect={handleSelectPlan}
                billingPeriod={billingPeriod}
                isLoading={createCheckout.isPending}
              />
            </div>
          ))}
        </div>

        {/* Highlights Section */}
        <div className="grid md:grid-cols-3 gap-6 mt-16 mb-12">
          {highlights.map((item, index) => (
            <div 
              key={index}
              className="group flex items-center gap-4 p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
            >
              <div className="flex-shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <item.icon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{item.label}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto py-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold">{t("pricing.faqTitle")}</h2>
            <p className="text-muted-foreground mt-2">Tudo o que você precisa saber sobre nossos planos</p>
          </div>
          
          <Accordion type="single" collapsible className="w-full space-y-3">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`faq-${index}`}
                className="border border-border/50 rounded-xl px-6 data-[state=open]:bg-muted/30 data-[state=open]:border-primary/20 transition-all duration-200"
              >
                <AccordionTrigger className="text-left hover:no-underline py-5">
                  <span className="font-medium">{faq.question}</span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* CTA Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-8 md:p-12 mb-12">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-accent/20 rounded-full blur-3xl" />
          </div>
          
          <div className="relative text-center space-y-4">
            <h3 className="text-2xl md:text-3xl font-bold">Ainda tem dúvidas?</h3>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Nossa equipe está pronta para ajudar você a escolher o melhor plano para sua equipe.
            </p>
            <a 
              href="mailto:contato@soma.com" 
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
            >
              Falar com especialista
              <Sparkles className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
