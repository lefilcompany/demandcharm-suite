import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, LayoutGrid, Timer, ClipboardCheck, ArrowRight } from 'lucide-react';

const steps = [
  {
    title: "Defina o escopo",
    subtitle: "mensal de cada cliente.",
    description: "Estabeleça limites claros do que está incluso no contrato mensal.",
    icon: Target,
  },
  {
    title: "Registre demandas",
    subtitle: "automaticamente.",
    description: "Cada solicitação vira um card no Kanban com rastreamento completo.",
    icon: LayoutGrid,
  },
  {
    title: "Cronometre tarefas",
    subtitle: "para sua gestão.",
    description: "Acompanhe o tempo investido em cada entrega com precisão.",
    icon: Timer,
  },
  {
    title: "Acompanhe entregas",
    subtitle: "com transparência total.",
    description: "Mostre ao cliente exatamente o que foi realizado no período.",
    icon: ClipboardCheck,
  },
];

const HowItWorksSection: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const mobileContainerRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(0);

  useEffect(() => {
    const updateLineHeight = () => {
      if (!mobileContainerRef.current) return;
      const icons = mobileContainerRef.current.querySelectorAll('[data-step-icon]');
      if (icons.length < 2) return;
      const first = icons[0] as HTMLElement;
      const last = icons[icons.length - 1] as HTMLElement;
      const containerTop = mobileContainerRef.current.getBoundingClientRect().top;
      const firstCenter = first.getBoundingClientRect().top + first.offsetHeight / 2 - containerTop;
      const lastCenter = last.getBoundingClientRect().top + last.offsetHeight / 2 - containerTop;
      setLineHeight(lastCenter - firstCenter);
    };
    updateLineHeight();
    window.addEventListener('resize', updateLineHeight);
    return () => window.removeEventListener('resize', updateLineHeight);
  }, []);

  return (
    <section id="como-funciona" className="py-24 px-4 bg-gradient-to-b from-gray-50 to-white overflow-hidden">
      <div className="container mx-auto max-w-6xl">
        <motion.span 
          className="inline-block px-4 py-2 bg-soma-orange-light/10 text-soma-orange-dark rounded-full text-sm font-semibold mb-4"
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          4 PASSOS SIMPLES
        </motion.span>
        <motion.h2 
          className="text-3xl md:text-5xl font-bold text-soma-black mb-4 text-center"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          Como funciona na prática:
        </motion.h2>
        
        <motion.p
          className="text-lg text-gray-500 text-center mb-16 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Uma jornada simples do caos à clareza
        </motion.p>

        {/* Timeline Desktop */}
        <div className="hidden lg:block relative">
          {/* Connecting Line */}
          <div className="absolute top-24 left-0 right-0 h-1 bg-gray-200 rounded-full">
            <motion.div 
              className="h-full bg-gradient-to-r from-soma-orange-light to-soma-orange-dark rounded-full"
              initial={{ width: "0%" }}
              whileInView={{ width: `${((activeStep + 1) / steps.length) * 100}%` }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>

          {/* Steps */}
          <div className="relative flex justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === activeStep;
              const isPast = index < activeStep;

              return (
                <motion.div
                  key={index}
                  className="flex flex-col items-center w-1/4 cursor-pointer"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  onClick={() => setActiveStep(index)}
                  onMouseEnter={() => { setActiveStep(index); setIsHovering(true); }}
                  onMouseLeave={() => setIsHovering(false)}
                >
                  {/* Circle with Icon */}
                  <motion.div
                    className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all duration-300 ${
                      isActive 
                        ? 'bg-soma-orange-dark shadow-lg shadow-soma-orange-dark/30' 
                        : isPast 
                          ? 'bg-soma-orange-light' 
                          : 'bg-white border-2 border-gray-200'
                    }`}
                    whileHover={{ scale: 1.1 }}
                    animate={isActive ? { scale: [1, 1.05, 1] } : {}}
                    transition={{ duration: 0.5, repeat: isActive && !isHovering ? Infinity : 0, repeatDelay: 1 }}
                  >
                    <Icon className={`w-8 h-8 ${isActive || isPast ? 'text-white' : 'text-gray-400'}`} />
                    
                    {/* Pulse ring for active */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-full border-2 border-soma-orange-dark"
                        animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    )}
                  </motion.div>

                  {/* Step Number */}
                  <motion.span 
                    className={`text-sm font-bold mb-2 ${isActive ? 'text-soma-orange-dark' : 'text-gray-400'}`}
                  >
                    0{index + 1}
                  </motion.span>

                  {/* Title */}
                  <h3 className={`text-lg font-bold text-center transition-colors ${isActive ? 'text-soma-black' : 'text-gray-600'}`}>
                    {step.title}
                  </h3>
                  <p className={`text-sm text-center transition-colors ${isActive ? 'text-soma-orange-dark' : 'text-gray-400'}`}>
                    {step.subtitle}
                  </p>

                  {/* Description - shows on active */}
                  <AnimatePresence>
                    {isActive && (
                      <motion.p
                        className="text-sm text-gray-500 text-center mt-4 max-w-[200px]"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        {step.description}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          {/* Navigation Arrows */}
          <div className="flex justify-center mt-12 gap-4">
            {steps.map((_, index) => (
              <motion.button
                key={index}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === activeStep ? 'bg-soma-orange-dark w-8' : 'bg-gray-300 hover:bg-gray-400'
                }`}
                onClick={() => setActiveStep(index)}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              />
            ))}
          </div>
        </div>

        {/* Mobile View - Vertical Timeline */}
        <div className="lg:hidden">
          <div ref={mobileContainerRef} className="relative flex flex-col items-center">
            {/* Vertical Line - from first icon center to last icon center */}
            {lineHeight > 0 && (
              <div 
                className="absolute left-1/2 -translate-x-1/2 w-0.5 bg-gray-200" 
                style={{ top: '1.25rem', height: `${lineHeight}px` }}
              >
                <motion.div 
                  className="w-full bg-gradient-to-b from-soma-orange-light to-soma-orange-dark"
                  initial={{ height: "0%" }}
                  whileInView={{ height: "100%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
              </div>
            )}

            {steps.map((step, index) => {
              const Icon = step.icon;
              const isLast = index === steps.length - 1;
              
              return (
                <motion.div
                  key={index}
                  className={`relative flex flex-col items-center w-full ${isLast ? 'mb-0' : 'mb-12'}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                >
                  {/* Circle - centered */}
                  <motion.div
                    data-step-icon
                    className="relative z-10 w-10 h-10 rounded-full bg-soma-orange-dark flex items-center justify-center shadow-lg"
                    whileInView={{ scale: [0, 1.2, 1] }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: index * 0.15 + 0.2 }}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </motion.div>

                  {/* Content Card */}
                  <motion.div
                    className="mt-4 p-6 bg-white rounded-xl shadow-md border border-gray-100 w-full max-w-sm text-center"
                    whileHover={{ y: -3, boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)" }}
                  >
                    <span className="text-xs font-bold text-soma-orange-light">PASSO 0{index + 1}</span>
                    <h3 className="text-xl font-bold text-soma-black mt-1">
                      {step.title} <span className="text-soma-orange-dark">{step.subtitle}</span>
                    </h3>
                    <p className="text-gray-500 mt-2 text-sm">
                      {step.description}
                    </p>
                    
                    {index < steps.length - 1 && (
                      <div className="flex items-center justify-center mt-4 text-soma-orange-dark text-sm font-medium">
                        <span>Próximo passo</span>
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
