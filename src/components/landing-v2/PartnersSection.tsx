import React from 'react';
import { motion } from 'framer-motion';

import lefilLogo from '@/assets/partners/lefil.png';
import marketingFuturoLogo from '@/assets/partners/marketing-futuro.png';
import raymundoFonteLogo from '@/assets/partners/raymundo-fonte.png';
import magaluLogo from '@/assets/partners/magalu.png';
import lumiLogo from '@/assets/partners/lumi.png';
import juqLogo from '@/assets/partners/juq.png';

const partners = [
  { name: 'Lefil', logo: lefilLogo },
  { name: 'Marketing do Futuro', logo: marketingFuturoLogo },
  { name: 'Grupo Raymundo da Fonte', logo: raymundoFonteLogo },
  { name: 'Magalu', logo: magaluLogo },
  { name: 'Lumi', logo: lumiLogo },
  { name: 'Juq', logo: juqLogo },
];

const PartnersSection: React.FC = () => {
  const duplicatedPartners = [...partners, ...partners, ...partners];

  return (
    <section className="bg-white py-16 px-4">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <span className="inline-block px-4 py-2 bg-soma-orange-light/10 text-soma-orange-dark rounded-full text-sm font-semibold mb-4">
            MARCAS QUE CONFIAM
          </span>
          <h2 className="text-3xl md:text-5xl font-bold text-soma-black">
            Quem já usa o SoMA
          </h2>
        </motion.div>

        <div className="relative overflow-hidden bg-soma-orange-dark py-10 px-4 -mx-4 sm:-mx-6 md:-mx-8 lg:-mx-[calc((100vw-72rem)/2+2rem)] xl:-mx-[calc((100vw-72rem)/2+2rem)]" style={{ marginLeft: 'calc(-50vw + 50%)', marginRight: 'calc(-50vw + 50%)', borderRadius: 0 }}>
          <motion.div
            className="flex items-center gap-20"
            animate={{
              x: [0, -100 * partners.length * 2],
            }}
            transition={{
              x: {
                repeat: Infinity,
                repeatType: "loop",
                duration: 25,
                ease: "linear",
              },
            }}
          >
            {duplicatedPartners.map((partner, index) => (
              <div
                key={`${partner.name}-${index}`}
                className="flex-shrink-0 flex items-center justify-center h-16 w-40"
              >
                <img
                  src={partner.logo}
                  alt={partner.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default PartnersSection;
