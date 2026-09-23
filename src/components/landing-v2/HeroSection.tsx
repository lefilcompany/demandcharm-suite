import React from 'react';
import { Button } from './ui/button';
import heroImage from '@/assets/hero-image.png';

const HeroSection: React.FC = () => {

  return (
    <section className="bg-soma-black flex flex-col pt-28 md:pt-32 lg:pt-36 pb-10 md:pb-14 lg:pb-16 px-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-radial from-soma-black/80 to-soma-black opacity-50 z-0"></div>
      
      {/* Main Hero Content */}
      <div className="container mx-auto max-w-7xl relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center w-full">
          {/* Image - first on mobile, second on desktop */}
          <div className="relative animate-fade-in order-1 lg:order-2 lg:scale-110 lg:translate-x-4 mt-4 lg:mt-0">
            <div className="rounded-2xl overflow-hidden">
              <img src={heroImage} alt="SoMA Platform" className="w-full h-auto object-cover" />
            </div>
          </div>

          {/* Content - second on mobile, first on desktop */}
          <div className="text-center lg:text-left order-2 lg:order-1">
            <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white tracking-tight mb-4 lg:mb-6 animate-fade-in" style={{
              lineHeight: 1.1
            }}>
              Seu marketing precisa de <span className="text-soma-orange-light">escopo</span>. 
              <br className="hidden md:block" />
              Seu escopo precisa de <span className="text-soma-orange-light">controle</span>.
            </h1>
            
            <p className="text-gray-300 text-base md:text-lg lg:text-xl max-w-xl mx-auto lg:mx-0 leading-relaxed mb-6 lg:mb-8 animate-slide-up">
              Acompanhe solicitações em tempo real e mantenha controle total das entregas
            </p>
            
            <div className="animate-fade-in flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <a href="https://pla.soma.lefil.com.br" target="_blank" rel="noopener noreferrer" className="group">
                <Button className="text-white font-semibold h-auto py-3.5 lg:py-4 text-base lg:text-lg px-8 lg:px-10 bg-gradient-to-r from-soma-orange-light via-soma-orange-medium to-soma-orange-dark hover:from-soma-orange-medium hover:via-soma-orange-dark hover:to-soma-orange-dark w-full sm:w-auto shadow-lg shadow-soma-orange-medium/40 hover:shadow-xl hover:shadow-soma-orange-dark/50 transition-all duration-300 hover:scale-105 rounded-xl">
                  Testar grátis
                </Button>
              </a>
              <a href="#planos" className="group">
                <Button className="font-semibold h-auto py-3.5 lg:py-4 text-base lg:text-lg px-8 lg:px-10 border-2 border-soma-orange-dark bg-transparent hover:bg-soma-orange-light/20 w-full sm:w-auto text-soma-orange-dark transition-all duration-300 hover:scale-105 rounded-xl">
                  Contrate um plano
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
