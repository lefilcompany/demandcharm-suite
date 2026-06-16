import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { SectionShell } from "./SectionShell";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNotificationPreferences, NotificationPreferences } from "@/hooks/useNotificationPreferences";
import { Palette, Sun, Moon, Monitor, Bell, Globe } from "lucide-react";

export function PreferencesSection() {
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const { preferences, updatePreferences, isLoading } = useNotificationPreferences();

  const isDark = theme === "dark";

  const handleNotifToggle = (checked: boolean) => {
    const next: NotificationPreferences = {
      ...preferences,
      emailNotifications: checked,
      pushNotifications: checked,
    };
    updatePreferences(next);
    toast.success(t("toast.settingsSaved"));
  };

  const handleLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("app-language", lang);
    toast.success(t("toast.languageUpdated"));
  };

  const notifEnabled = preferences.emailNotifications || preferences.pushNotifications;

  return (
    <SectionShell icon={Palette} title="Aparência e Idioma" description="Personalize sua experiência">
      {/* Theme */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Sun className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <Label className="text-sm font-medium">Tema</Label>
            <p className="text-xs text-muted-foreground">Alterne entre claro, escuro ou sistema</p>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-md border bg-muted/30 p-0.5">
          <Button
            size="sm"
            variant={theme === "light" ? "default" : "ghost"}
            className="h-7 px-2"
            onClick={() => setTheme("light")}
          >
            <Sun className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant={theme === "dark" ? "default" : "ghost"}
            className="h-7 px-2"
            onClick={() => setTheme("dark")}
          >
            <Moon className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant={theme === "system" ? "default" : "ghost"}
            className="h-7 px-2"
            onClick={() => setTheme("system")}
          >
            <Monitor className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Separator />

      {/* Notifications shortcut */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Bell className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <Label className="text-sm font-medium">Notificações</Label>
            <p className="text-xs text-muted-foreground">Receber alertas e atualizações</p>
          </div>
        </div>
        <Switch checked={notifEnabled} onCheckedChange={handleNotifToggle} disabled={isLoading} />
      </div>

      <Separator />

      {/* Language */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <Globe className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <Label className="text-sm font-medium">Idioma</Label>
            <p className="text-xs text-muted-foreground">{i18n.language === "pt-BR" ? "Português (Brasil)" : i18n.language === "en-US" ? "English (US)" : "Español"}</p>
          </div>
        </div>
        <Select value={i18n.language} onValueChange={handleLanguage}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pt-BR">🇧🇷 Português</SelectItem>
            <SelectItem value="en-US">🇺🇸 English</SelectItem>
            <SelectItem value="es">🇪🇸 Español</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </SectionShell>
  );
}
