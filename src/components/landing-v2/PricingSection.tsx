import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const plans = [
  {
    name: 'Starter',
    description: 'Ideal para freelancers e pequenos projetos',
    price: 59,
    specs: ['1 quadros', '3 membros', '30 demandas/mês'],
    features: {
      'Time Tracking': 'Básico',
      'Notificações': true,
      'Relatórios': true,
      'Resumo IA': false,
      'Compartilhamento Externo': false,
      'Acesso à API': false,
      'SLA Garantido': false,
    },
    highlighted: false,
    cta: 'Selecionar Plano',
    href: '/get-started',
  },
  {
    name: 'Profissional',
    description: 'Para agências pequenas e equipes de marketing',
    price: 97,
    specs: ['5 quadros', '10 membros', '200 demandas/mês'],
    features: {
      'Time Tracking': 'Completo',
      'Notificações': 'Push + Email',
      'Relatórios': 'PDF/CSV',
      'Resumo IA': true,
      'Compartilhamento Externo': true,
      'Acesso à API': false,
      'SLA Garantido': false,
    },
    highlighted: true,
    cta: 'Selecionar Plano',
    href: '/get-started',
  },
  {
    name: 'Business',
    description: 'Para agências médias e escritórios',
    price: 247,
    specs: ['15 quadros', '30 membros', '500 demandas/mês'],
    features: {
      'Time Tracking': 'Completo',
      'Notificações': 'Push + Email',
      'Relatórios': 'Avançado',
      'Resumo IA': true,
      'Compartilhamento Externo': true,
      'Acesso à API': true,
      'SLA Garantido': false,
    },
    highlighted: false,
    cta: 'Selecionar Plano',
    href: '/get-started',
  },
  {
    name: 'Enterprise',
    description: 'Solução personalizada para grandes empresas',
    price: 497,
    specs: ['Ilimitado', 'Ilimitado', 'Ilimitado'],
    features: {
      'Time Tracking': 'Completo',
      'Notificações': 'Push + Email',
      'Relatórios': 'Whitelabel',
      'Resumo IA': true,
      'Compartilhamento Externo': true,
      'Acesso à API': true,
      'SLA Garantido': true,
    },
    highlighted: false,
    cta: 'Entre em contato',
    href: 'https://wa.me/558199660072',
  },
];

const PricingSection: React.FC = () => {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const getPrice = (basePrice: number) => {
    if (billingPeriod === 'yearly') {
      return Math.round(basePrice * 0.8);
    }
    return basePrice;
  };

  return (
    <section id="planos" className="bg-gray-50 py-24 px-4">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-12">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-bold text-soma-black mb-4"
          >
            Planos e Preços
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            viewport={{ once: true }}
            className="text-gray-600 text-lg max-w-2xl mx-auto"
          >
            Escolha o plano ideal para sua equipe e comece a organizar suas demandas
          </motion.p>
        </div>

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          viewport={{ once: true }}
          className="flex items-center justify-center gap-4 mb-12"
        >
          <span className={`text-sm font-medium ${billingPeriod === 'monthly' ? 'text-soma-black' : 'text-gray-400'}`}>
            Mensal
          </span>
          <button
            onClick={() => setBillingPeriod(billingPeriod === 'monthly' ? 'yearly' : 'monthly')}
            className={`relative w-14 h-7 rounded-full transition-colors ${
              billingPeriod === 'yearly' ? 'bg-soma-orange-medium' : 'bg-gray-300'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full transition-transform ${
                billingPeriod === 'yearly' ? 'translate-x-7' : 'translate-x-0'
              }`}
            />
          </button>
          <span className={`text-sm font-medium ${billingPeriod === 'yearly' ? 'text-soma-black' : 'text-gray-400'}`}>
            Anual
          </span>
          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
            Economize 20%
          </span>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.1 }}
              viewport={{ once: true }}
              className={`relative rounded-2xl p-6 flex flex-col ${
                plan.highlighted
                  ? 'bg-soma-black text-white border-2 border-soma-orange-medium shadow-2xl lg:scale-105 z-10'
                  : 'bg-white text-soma-black border border-gray-200'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-soma-orange-medium text-white text-xs font-semibold rounded-full whitespace-nowrap">
                  Mais Popular
                </span>
              )}

              <div className="mb-4">
                <h3 className={`text-xl font-bold mb-1 ${plan.highlighted ? 'text-white' : 'text-soma-black'}`}>
                  {plan.name}
                </h3>
                <p className={`text-sm ${plan.highlighted ? 'text-gray-300' : 'text-gray-600'}`}>
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <span className={`text-3xl font-bold ${plan.highlighted ? 'text-white' : 'text-soma-black'}`}>
                  R$ {getPrice(plan.price)},00
                </span>
                <span className={`text-sm ${plan.highlighted ? 'text-gray-300' : 'text-gray-600'}`}>
                  /mês
                </span>
              </div>

              {/* Specs */}
              <div className={`mb-6 pb-6 border-b ${plan.highlighted ? 'border-gray-700' : 'border-gray-200'}`}>
                {plan.specs.map((spec, specIndex) => (
                  <div key={specIndex} className={`text-sm font-medium mb-1 ${plan.highlighted ? 'text-gray-200' : 'text-gray-700'}`}>
                    {spec}
                  </div>
                ))}
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-6 flex-grow">
                {Object.entries(plan.features).map(([feature, value], featureIndex) => {
                  const isAvailable = value !== false;
                  const displayValue = typeof value === 'string' ? `(${value})` : '';
                  
                  return (
                    <li key={featureIndex} className="flex items-center gap-2">
                      {isAvailable ? (
                        <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                          plan.highlighted ? 'bg-soma-orange-medium' : 'bg-green-100'
                        }`}>
                          <Check className={`w-3 h-3 ${plan.highlighted ? 'text-white' : 'text-green-600'}`} />
                        </span>
                      ) : (
                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-gray-200">
                          <X className="w-3 h-3 text-gray-400" />
                        </span>
                      )}
                      <span className={`text-sm ${
                        isAvailable 
                          ? (plan.highlighted ? 'text-gray-200' : 'text-gray-700')
                          : 'text-gray-400 line-through'
                      }`}>
                        {feature} {displayValue}
                      </span>
                    </li>
                  );
                })}
              </ul>

              <a href={plan.href}>
                <Button
                  className={`w-full py-5 text-sm font-semibold rounded-xl transition-all ${
                    plan.highlighted
                      ? 'bg-soma-orange-medium hover:bg-soma-orange-dark text-white'
                      : 'bg-soma-black hover:bg-gray-800 text-white'
                  }`}
                >
                  {plan.cta}
                </Button>
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
