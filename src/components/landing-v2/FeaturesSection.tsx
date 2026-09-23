import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Columns3, 
  Timer, 
  Users, 
  Sparkles, 
  Bell, 
  FileBarChart,
  LucideIcon
} from 'lucide-react';

// Import feature images
import kanbanImg from '@/assets/lp/features/kanban.png';
import timeTrackingImg from '@/assets/lp/features/time-tracking.png';
import rolesImg from '@/assets/lp/features/roles.png';
import aiSummaryImg from '@/assets/lp/features/ai-summary.png';
import notificationsImg from '@/assets/lp/features/notifications.png';
import reportsImg from '@/assets/lp/features/reports.png';

interface Feature {
  title: string;
  description: string;
  icon: LucideIcon;
  image: string;
  highlight: string;
}

const features: Feature[] = [
  {
    title: "Kanban Visual",
    description: "Arraste e solte cards para alterar status. Atualizações em tempo real para toda a equipe.",
    icon: Columns3,
    image: kanbanImg,
    highlight: "Drag & Drop",
  },
  {
    title: "Time Tracking",
    description: "Cronômetros em tempo real por demanda e por usuário. Relatórios detalhados de produtividade.",
    icon: Timer,
    image: timeTrackingImg,
    highlight: "Tempo Real",
  },
  {
    title: "Papéis Personalizados",
    description: "4 níveis de acesso: Administrador, Coordenador, Agente e Solicitante.",
    icon: Users,
    image: rolesImg,
    highlight: "4 Níveis",
  },
  {
    title: "Resumo IA",
    description: "Análise inteligente do quadro com insights, alertas e sugestões automáticas.",
    icon: Sparkles,
    image: aiSummaryImg,
    highlight: "Inteligência",
  },
  {
    title: "Notificações Multi-canal",
    description: "Push (navegador), E-mail e In-App em tempo real.",
    icon: Bell,
    image: notificationsImg,
    highlight: "3 Canais",
  },
  {
    title: "Relatórios",
    description: "Exportação PDF/CSV com gráficos de throughput, distribuição e carga de trabalho.",
    icon: FileBarChart,
    image: reportsImg,
    highlight: "PDF/CSV",
  },
];

const FeaturesSection: React.FC = () => {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  return (
    <section id="funcionalidades" className="bg-gradient-to-b from-white to-gray-50 py-24 px-4 overflow-hidden">
      <div className="container mx-auto max-w-6xl">
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <motion.span 
            className="inline-block px-4 py-2 bg-soma-orange-light/10 text-soma-orange-dark rounded-full text-sm font-semibold mb-4"
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            6 FUNCIONALIDADES ESSENCIAIS
          </motion.span>
          <h2 className="text-3xl md:text-5xl font-bold text-soma-black mb-4">
            Funcionalidades que fazem a diferença
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Tudo o que você precisa para gerenciar demandas, controlar tempo e entregar resultados com transparência.
          </p>
        </motion.div>
        
        {/* Grid Layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const isHovered = hoveredFeature === index;

            return (
              <motion.div
                key={index}
                className="relative rounded-2xl cursor-pointer overflow-hidden bg-white border border-gray-100 shadow-sm"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                onMouseEnter={() => setHoveredFeature(index)}
                onMouseLeave={() => setHoveredFeature(null)}
                whileHover={{ y: -8 }}
              >
                {/* Image Container */}
                <div className="relative h-56 overflow-hidden">
                  <motion.img
                    src={feature.image}
                    alt={feature.title}
                    className="w-full h-full object-cover"
                    animate={{ 
                      scale: isHovered ? 1.08 : 1,
                    }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  />
                  
                  {/* Highlight badge */}
                  <motion.span
                    className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold bg-white/90 backdrop-blur-sm text-gray-700 shadow-sm"
                    animate={{ 
                      scale: isHovered ? 1.05 : 1,
                      y: isHovered ? -2 : 0,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    {feature.highlight}
                  </motion.span>
                </div>

                {/* Text Content */}
                <div className="p-5">
                  <h3 className="text-lg font-bold text-soma-black mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
