
import React, { useState } from 'react';
import { Button } from './ui/button';
import { LogIn, Menu, X } from 'lucide-react';
import logoSoma from '@/assets/logo-soma-dark.png';

const navLinks = [
  { label: 'Como funciona', href: '#como-funciona' },
  { label: 'Funcionalidades', href: '#funcionalidades' },
  { label: 'Depoimentos', href: '#depoimentos' },
  { label: 'Planos', href: '#planos' },
];

const Header: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-6xl">
      <div className="backdrop-blur-md bg-white/80 border border-border rounded-2xl px-4 md:px-6 py-2 shadow-lg">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <a href="/" className="flex items-center shrink-0">
            <img src={logoSoma} alt="SoMA" className="h-6 md:h-8" />
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <a href="https://pla.soma.lefil.com.br/" target="_blank" rel="noopener noreferrer" className="hidden sm:inline-flex">
              <Button 
                variant="ghost" 
                size="sm"
                className="text-foreground hover:bg-muted font-medium"
              >
                <LogIn className="w-4 h-4 mr-1.5" />
                Login
              </Button>
            </a>
            
            <a href="https://pla.soma.lefil.com.br/" target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="bg-primary hover:bg-secondary text-primary-foreground font-medium px-4">
                Cadastre-se
              </Button>
            </a>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-1.5 rounded-lg hover:bg-muted text-foreground transition-colors"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <nav className="lg:hidden border-t border-border mt-2 pt-3 pb-2 flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://pla.soma.lefil.com.br/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileOpen(false)}
              className="sm:hidden px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors flex items-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              Login
            </a>
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;
