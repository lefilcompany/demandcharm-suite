
import React from 'react';
import SomaLogo from './SomaLogo';
import { Mail, Phone, MapPin, Instagram } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-950 py-16 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Logo e Descrição */}
          <div className="lg:col-span-1">
            <SomaLogo variant="light" className="h-12 md:h-14 mb-4" />
            <p className="text-gray-400 text-sm leading-relaxed">
              Plataforma de escopo inteligente que transforma a gestão de projetos de marketing.
            </p>
          </div>

          {/* Links Rápidos */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-lg">Plataforma</h4>
            <ul className="space-y-3">
              <li>
                <a href="#funcionalidades" className="text-gray-400 hover:text-soma-orange-light transition-colors text-sm">
                  Funcionalidades
                </a>
              </li>
              <li>
                <a href="#beneficios" className="text-gray-400 hover:text-soma-orange-light transition-colors text-sm">
                  Benefícios
                </a>
              </li>
              <li>
                <a href="#como-funciona" className="text-gray-400 hover:text-soma-orange-light transition-colors text-sm">
                  Como Funciona
                </a>
              </li>
              <li>
                <a href="#depoimentos" className="text-gray-400 hover:text-soma-orange-light transition-colors text-sm">
                  Depoimentos
                </a>
              </li>
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-lg">Contato</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-gray-400 text-sm">
                <Mail className="w-4 h-4 text-soma-orange-light" />
                <a href="mailto:lefil@lefil.com.br" className="hover:text-soma-orange-light transition-colors">
                  lefil@lefil.com.br
                </a>
              </li>
              <li className="flex items-center gap-2 text-gray-400 text-sm">
                <Phone className="w-4 h-4 text-soma-orange-light" />
                <span>+55 81 9966-0072</span>
              </li>
              <li className="flex items-start gap-2 text-gray-400 text-sm">
                <MapPin className="w-4 h-4 text-soma-orange-light mt-0.5" />
                <span>Recife - PE</span>
              </li>
            </ul>
          </div>

          {/* Redes Sociais */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-lg">Redes Sociais</h4>
            <div className="flex gap-3">
              <a 
                href="https://instagram.com/_lefil" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-gray-800 hover:bg-soma-orange-dark flex items-center justify-center transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5 text-white" />
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-gray-500 text-sm">
              © {new Date().getFullYear()} SoMA. Todos os direitos reservados.
            </div>
            <div className="flex gap-6">
              <a href="#" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
                Política de Privacidade
              </a>
              <a href="#" className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
                Termos de Uso
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
