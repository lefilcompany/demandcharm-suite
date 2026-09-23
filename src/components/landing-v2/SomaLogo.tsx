
import React from 'react';

interface SomaLogoProps {
  variant: 'light' | 'dark';
  className?: string;
}

const SomaLogo: React.FC<SomaLogoProps> = ({ variant, className = "" }) => {
  const logoSrc = variant === 'light' 
    ? '/lovable-uploads/4043b736-ed9e-41bd-b8ca-46c3ee266a41.png' 
    : '/lovable-uploads/91ceb0ed-32d9-488c-8277-9f3f30fd8294.png';
  
  return (
    <img 
      src={logoSrc} 
      alt="SoMA Logo" 
      className={`h-16 md:h-20 ${className}`}
    />
  );
};

export default SomaLogo;
