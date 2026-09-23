import React from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

const comparisonData = [
  { feature: 'Controle de escopo por cliente', others: false, soma: true },
  { feature: 'Limite de demandas mensais', others: false, soma: true },
  { feature: 'Visualização de entregas por status', others: 'Parcial', soma: 'Completo' },
  { feature: 'Foco exclusivo em marketing', others: false, soma: true },
  { feature: 'Simplicidade e clareza para o cliente', others: false, soma: true },
];

const ComparisonSection: React.FC = () => {
  return (
    <section className="bg-soma-black py-24 px-4">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-16">
          <motion.span 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block px-4 py-2 bg-soma-orange-light/20 text-soma-orange-light rounded-full text-sm font-semibold mb-4"
          >
            COMPARATIVO
          </motion.span>
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold text-white"
          >
            Por que outras ferramentas não resolvem esse problema?
          </motion.h2>
        </div>
        
        <motion.div 
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          viewport={{ once: true }}
          className="bg-gray-900/60 rounded-2xl border border-gray-800 overflow-hidden backdrop-blur-sm"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="text-left py-5 px-6 text-lg font-semibold text-white">Recurso</th>
                  <th className="text-center py-5 px-6 text-lg font-medium text-gray-400">Outras Plataformas</th>
                  <th className="text-center py-5 px-6 text-lg font-semibold text-soma-orange-light">SoMA</th>
                </tr>
              </thead>
              <tbody>
                {comparisonData.map((row, index) => (
                  <motion.tr 
                    key={index} 
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    viewport={{ once: true }}
                    className={`border-b border-gray-800/50 last:border-b-0 transition-colors duration-300 hover:bg-gray-800/40`}
                  >
                    <td className="py-5 px-6 text-base text-gray-300">{row.feature}</td>
                    <td className="py-5 px-6 text-center">
                      {typeof row.others === 'boolean' ? (
                        row.others ? (
                          <motion.span 
                            initial={{ scale: 0 }}
                            whileInView={{ scale: 1 }}
                            transition={{ delay: 0.4 + index * 0.1, type: "spring" }}
                            viewport={{ once: true }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-500/20"
                          >
                            <Check className="w-5 h-5 text-green-500" />
                          </motion.span>
                        ) : (
                          <motion.span 
                            initial={{ scale: 0 }}
                            whileInView={{ scale: 1 }}
                            transition={{ delay: 0.4 + index * 0.1, type: "spring" }}
                            viewport={{ once: true }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20"
                          >
                            <X className="w-5 h-5 text-red-500" />
                          </motion.span>
                        )
                      ) : (
                        <motion.span 
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          transition={{ delay: 0.4 + index * 0.1 }}
                          viewport={{ once: true }}
                          className="inline-block px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-sm font-medium"
                        >
                          {row.others}
                        </motion.span>
                      )}
                    </td>
                    <td className="py-5 px-6 text-center">
                      {typeof row.soma === 'boolean' ? (
                        row.soma ? (
                          <motion.span 
                            initial={{ scale: 0 }}
                            whileInView={{ scale: 1 }}
                            transition={{ delay: 0.5 + index * 0.1, type: "spring" }}
                            viewport={{ once: true }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-soma-orange-light/20"
                          >
                            <Check className="w-5 h-5 text-soma-orange-light" />
                          </motion.span>
                        ) : (
                          <motion.span 
                            initial={{ scale: 0 }}
                            whileInView={{ scale: 1 }}
                            transition={{ delay: 0.5 + index * 0.1, type: "spring" }}
                            viewport={{ once: true }}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20"
                          >
                            <X className="w-5 h-5 text-red-500" />
                          </motion.span>
                        )
                      ) : (
                        <motion.span 
                          initial={{ opacity: 0 }}
                          whileInView={{ opacity: 1 }}
                          transition={{ delay: 0.5 + index * 0.1 }}
                          viewport={{ once: true }}
                          className="inline-block px-3 py-1 rounded-full bg-soma-orange-light/20 text-soma-orange-light text-sm font-medium"
                        >
                          {row.soma}
                        </motion.span>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default ComparisonSection;
