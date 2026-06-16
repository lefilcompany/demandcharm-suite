import { ReactNode } from "react";
import dashboardBanner from "@/assets/dashboard-banner.jpg";

interface DashboardBannerProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function DashboardBanner({ 
  title = "Gestão Inteligente de Demandas",
  subtitle = "Acompanhe suas solicitações em tempo real e mantenha o controle total das suas entregas",
  actions
}: DashboardBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-xl shadow-[0_8px_30px_-5px_hsl(var(--primary)/0.5)]">
      <img 
        src={dashboardBanner} 
        alt="Gestão de demandas" 
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/60 to-black/20 dark:from-black/90 dark:via-black/75 dark:to-black/40"></div>
      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-5 md:p-6 lg:p-8">
        <div className="flex-1 min-w-0">
          <h2 className="text-lg md:text-xl lg:text-2xl font-bold mb-1 text-white">
            {title}
          </h2>
          <p className="text-white/80 text-xs md:text-sm max-w-md leading-relaxed">
            {subtitle}
          </p>
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
