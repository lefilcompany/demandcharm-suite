import { useTranslation } from "react-i18next";
import { ShieldCheck, Zap, Clock, Award } from "lucide-react";
import logoSomaDark from "@/assets/logo-soma-dark.png";
import authBackground from "@/assets/auth-background.jpg";

export function GetStartedHero() {
  const { t } = useTranslation();

  const benefits = [
    { icon: Zap, label: "Ativação instantânea" },
    { icon: Clock, label: "Suporte 24/7" },
    { icon: Award, label: "Garantia de satisfação" },
  ];

  return (
    <>
      {/* Desktop Hero */}
      <div
        className="hidden lg:flex lg:w-2/5 xl:w-[45%] h-full shrink-0 relative overflow-hidden"
        style={{
          backgroundImage: `url(${authBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* Multi-layer gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/70 to-accent/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
        
        {/* Decorative elements */}
        <div className="absolute top-20 right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-40 left-10 w-24 h-24 bg-accent/20 rounded-full blur-2xl animate-pulse delay-1000" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-8 xl:p-12 text-white h-full">
          {/* Logo */}
          <img src={logoSomaDark} alt="SoMA" className="h-10 xl:h-12 w-auto self-start" />
          
          {/* Main content */}
          <div className="space-y-8">
            <div className="max-w-sm xl:max-w-md">
              <h1 className="text-3xl xl:text-4xl font-bold mb-4 leading-tight">
                {t("getStarted.heroTitle")}
              </h1>
              <p className="text-base xl:text-lg text-white/90 leading-relaxed">
                {t("getStarted.heroSubtitle")}
              </p>
            </div>
            
            {/* Benefits */}
            <div className="space-y-3">
              {benefits.map((benefit, index) => (
                <div 
                  key={index} 
                  className="flex items-center gap-3 text-white/90"
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-white/20 backdrop-blur-sm">
                    <benefit.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{benefit.label}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Footer */}
          <div className="flex items-center gap-3 text-white/80 pt-4 border-t border-white/10">
            <ShieldCheck className="h-5 w-5 text-white" />
            <span className="text-sm font-medium">{t("getStarted.securePayment")}</span>
          </div>
        </div>
      </div>

      {/* Mobile Hero */}
      <div
        className="lg:hidden relative h-40 sm:h-48 flex-shrink-0 overflow-hidden"
        style={{
          backgroundImage: `url(${authBackground})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-primary/85 via-primary/70 to-background" />
        
        {/* Decorative blur */}
        <div className="absolute top-4 right-8 w-20 h-20 bg-white/10 rounded-full blur-2xl" />
        
        <div className="relative z-10 flex flex-col items-center justify-center h-full text-white px-6 text-center">
          <img src={logoSomaDark} alt="SoMA" className="h-8 sm:h-10 w-auto mb-3" />
          <h2 className="text-xl sm:text-2xl font-bold mb-1">{t("getStarted.title")}</h2>
          <p className="text-sm text-white/80">{t("getStarted.heroSubtitle")}</p>
        </div>
      </div>
    </>
  );
}
