import React, { useEffect } from 'react';
import Header from '../components/Header';
import HeroSection from '../components/HeroSection';
import HowItWorksSection from '../components/HowItWorksSection';
import FeaturesSection from '../components/FeaturesSection';
import TestimonialsSection from '../components/TestimonialsSection';
import PartnersSection from '../components/PartnersSection';
import PricingSection from '../components/PricingSection';
import ApplicationsSection from '../components/ApplicationsSection';
import FinalSection from '../components/FinalSection';
import Footer from '../components/Footer';

const Index: React.FC = () => {
  useEffect(() => {
    document.title = "SoMA - Plataforma de Escopo Inteligente para Marketing";
    
    // Update canonical for SPA
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (canonical) {
      canonical.href = "https://soma.lefil.com.br/";
    }
  }, []);

  return (
    <div className="min-h-screen bg-white overflow-hidden">
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

export default Index;
