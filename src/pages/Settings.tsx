import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Settings as SettingsIcon, User, KeyRound, Palette, Bell, Users, Shield, Eye } from "lucide-react";
import { PageBreadcrumb } from "@/components/PageBreadcrumb";
import { SEOHead } from "@/components/SEOHead";
import { useSelectedTeam } from "@/contexts/TeamContext";
import {
  SettingsSidebar,
  SettingsTab,
  SettingsNavItem,
} from "@/components/settings/SettingsSidebar";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { PublicProfileSection } from "@/components/settings/PublicProfileSection";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { PreferencesSection } from "@/components/settings/PreferencesSection";
import { NotificationsSection } from "@/components/settings/NotificationsSection";
import { TeamSection } from "@/components/settings/TeamSection";
import { AccountSection } from "@/components/settings/AccountSection";

export default function Settings() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentTeam } = useSelectedTeam();

  const initialTab = (searchParams.get("tab") as SettingsTab) || "profile";
  const [active, setActive] = useState<SettingsTab>(initialTab);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tab = searchParams.get("tab") as SettingsTab | null;
    if (tab && tab !== active) setActive(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Scroll to top whenever the active tab changes — climbs the DOM
  // looking for the nearest scrollable ancestor (project uses 100dvh shells,
  // so window scroll is usually a no-op).
  useEffect(() => {
    const node = topRef.current;
    if (!node) return;

    const findScrollable = (el: HTMLElement | null): HTMLElement | Window => {
      let current: HTMLElement | null = el?.parentElement ?? null;
      while (current) {
        const style = window.getComputedStyle(current);
        const overflowY = style.overflowY;
        const canScroll = (overflowY === "auto" || overflowY === "scroll") && current.scrollHeight > current.clientHeight;
        if (canScroll) return current;
        current = current.parentElement;
      }
      return window;
    };

    const target = findScrollable(node);
    if (target instanceof Window) {
      target.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      target.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [active]);

  const handleChange = (tab: SettingsTab) => {
    setActive(tab);
    const params = new URLSearchParams(searchParams);
    params.set("tab", tab);
    setSearchParams(params, { replace: true });
  };

  const items: SettingsNavItem[] = [
    { id: "profile", label: "Perfil", description: "Informações pessoais", icon: User },
    { id: "public-profile", label: "Perfil público", description: "O que outros veem", icon: Eye },
    { id: "security", label: "Segurança", description: "Senha e autenticação", icon: KeyRound },
    { id: "preferences", label: "Preferências", description: "Aparência e idioma", icon: Palette },
    { id: "notifications", label: "Notificações", description: "Alertas e canais", icon: Bell },
    ...(currentTeam ? [{ id: "team" as const, label: "Equipe", description: "Participação e gestão", icon: Users }] : []),
    { id: "account", label: "Conta", description: "Gerenciar conta", icon: Shield },
  ];

  return (
    <div ref={topRef} className="space-y-6 animate-fade-in pb-8">
      <SEOHead title="Configurações" path="/settings" />
      <PageBreadcrumb items={[{ label: t("settings.title"), icon: SettingsIcon, isCurrent: true }]} />

      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("settings.title")}</h1>
        <p className="text-muted-foreground">Gerencie seu perfil, segurança e preferências</p>
      </div>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        <aside className="md:sticky md:top-4 md:self-start">
          <SettingsSidebar items={items} active={active} onChange={handleChange} />
        </aside>

        <main className="min-w-0">
          {active === "profile" && <ProfileSection />}
          {active === "public-profile" && <PublicProfileSection />}
          {active === "security" && <SecuritySection />}
          {active === "preferences" && <PreferencesSection />}
          {active === "notifications" && <NotificationsSection />}
          {active === "team" && <TeamSection />}
          {active === "account" && <AccountSection />}
        </main>
      </div>
    </div>
  );
}
