import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const FinalSection: React.FC = () => {
  return (
    <section className="bg-gradient-to-b from-gray-50 to-white py-24 px-4">
      <div className="container mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block px-4 py-2 bg-soma-orange-light/10 text-soma-orange-dark rounded-full text-sm font-semibold mb-4">
            COMECE AGORA
          </span>
          
          <h2 className="text-3xl md:text-5xl font-bold text-soma-black mb-6">
            Pronto para organizar seu marketing?
          </h2>
          
          <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed mb-10">
            Teste gratuitamente e descubra como o SoMA transforma a gestão de escopo da sua equipe.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-5 justify-center">
            <a href="/app">
              <Button className="text-white font-semibold h-auto py-4 text-lg px-10 bg-gradient-to-r from-soma-orange-light via-soma-orange-medium to-soma-orange-dark hover:from-soma-orange-medium hover:via-soma-orange-dark hover:to-soma-orange-dark shadow-lg shadow-soma-orange-medium/40 hover:shadow-xl transition-all duration-300 hover:scale-105 rounded-xl w-full sm:w-auto">
                Testar grátis
              </Button>
            </a>
            <a href="https://wa.me/558199660072" target="_blank" rel="noopener noreferrer">
              <Button className="font-semibold h-auto py-4 text-lg px-10 border-2 border-soma-orange-dark bg-transparent hover:bg-soma-orange-light/20 text-soma-orange-dark transition-all duration-300 hover:scale-105 rounded-xl w-full sm:w-auto">
                Entre em contato
              </Button>
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalSection;
