import React from "react";
import { SEOHead } from "@/components/SEOHead";
import Header from "@/components/landing-v2/Header";
import HeroSection from "@/components/landing-v2/HeroSection";
import HowItWorksSection from "@/components/landing-v2/HowItWorksSection";
import FeaturesSection from "@/components/landing-v2/FeaturesSection";
import TestimonialsSection from "@/components/landing-v2/TestimonialsSection";
import PartnersSection from "@/components/landing-v2/PartnersSection";
import PricingSection from "@/components/landing-v2/PricingSection";
import ApplicationsSection from "@/components/landing-v2/ApplicationsSection";
import FinalSection from "@/components/landing-v2/FinalSection";
import Footer from "@/components/landing-v2/Footer";

const Landing: React.FC = () => {
  return (
    <div className="lp-root h-full overflow-x-hidden overflow-y-auto bg-white">
      <SEOHead
        title="SoMA - Plataforma de Escopo Inteligente para Marketing"
        description="Organize e controle o escopo do seu marketing com o SoMA. Acompanhe solicitações em tempo real, gerencie entregas e mantenha transparência total entre equipe e cliente."
        path="/"
      />

      <Header />

      {/* Hero - O que é */}
      <HeroSection />

      {/* O que faz */}
      <HowItWorksSection />
      <FeaturesSection />

      {/* Resultados reais */}
      <TestimonialsSection />

      {/* Marcas que confiam */}
      <PartnersSection />

      {/* Planos */}
      <PricingSection />

      {/* Pra quem é */}
      <ApplicationsSection />

      {/* Comece a usar */}
      <FinalSection />

      <Footer />
    </div>
  );
};

export default Landing;
