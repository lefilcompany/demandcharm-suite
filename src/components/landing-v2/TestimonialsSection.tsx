import React from 'react';
import { motion } from 'framer-motion';

const testimonials = [
  {
    quote: "O SoMA transformou completamente nossa gestão de demandas. Agora temos visibilidade total do que está sendo entregue.",
    role: "Gerente de Marketing"
  },
  {
    quote: "Finalmente conseguimos controlar o escopo das entregas e evitar retrabalho. A produtividade da equipe aumentou muito.",
    role: "Coordenador de Projetos"
  },
  {
    quote: "A plataforma é intuitiva e nos ajudou a organizar todo o fluxo de trabalho com a agência parceira.",
    role: "Diretor de Comunicação"
  },
  {
    quote: "Com o time tracking conseguimos entender onde investimos mais tempo e otimizar nossos processos criativos.",
    role: "Head de Criação"
  }
];

const TestimonialsSection: React.FC = () => {
  return (
    <section id="depoimentos" className="bg-white py-20 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-2 bg-soma-orange-light/10 text-soma-orange-dark rounded-full text-sm font-semibold mb-4">
            DEPOIMENTOS
          </span>
          <h2 className="text-2xl md:text-4xl font-bold text-soma-black">
            Resultados reais para seu marketing
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              viewport={{ once: true }}
              className="bg-gray-50 border border-gray-100 rounded-2xl p-6 hover:shadow-md transition-shadow duration-300"
            >
              <div className="text-soma-orange-light text-4xl mb-4">"</div>
              <p className="text-gray-700 text-sm leading-relaxed mb-4">
                {testimonial.quote}
              </p>
              <p className="text-soma-orange-dark font-semibold text-sm">
                {testimonial.role}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;
