import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useTeamSubscription } from "@/hooks/useSubscription";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Crown, ExternalLink, ChevronRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsTab = "profile" | "public-profile" | "security" | "preferences" | "notifications" | "team" | "account";

export interface SettingsNavItem {
  id: SettingsTab;
  label: string;
  description: string;
  icon: LucideIcon;
}

interface SettingsSidebarProps {
  items: SettingsNavItem[];
  active: SettingsTab;
  onChange: (tab: SettingsTab) => void;
}

export function SettingsSidebar({ items, active, onChange }: SettingsSidebarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: subscription } = useTeamSubscription();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  const planName = subscription?.plan?.name || "Plano Gratuito";

  return (
    <div className="space-y-4">
      {/* Identity card */}
      <Card className="shadow-sm border rounded-xl">
        <CardContent className="p-5 flex flex-col items-center text-center">
          <Avatar className="h-20 w-20 border-2 border-background shadow-md">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || ""} className="object-cover" />
            <AvatarFallback className="text-xl bg-primary/10 text-primary font-semibold">
              {profile?.full_name ? getInitials(profile.full_name) : "?"}
            </AvatarFallback>
          </Avatar>
          <h3 className="mt-3 font-semibold text-foreground truncate max-w-full">
            {profile?.full_name || "Seu Nome"}
          </h3>
          <p className="text-xs text-muted-foreground truncate max-w-full">{user?.email}</p>
          <Badge variant="outline" className="mt-3 gap-1 font-normal">
            <Crown className="h-3 w-3" />
            {planName}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 w-full text-xs"
            onClick={() => navigate("/profile")}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Ver perfil público
          </Button>
        </CardContent>
      </Card>

      {/* Nav list */}
      <Card className="shadow-sm border rounded-xl overflow-hidden">
        <CardContent className="p-2">
          <nav className="flex flex-col gap-0.5" aria-label="Configurações">
            {items.map((item) => {
              const isActive = active === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onChange(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                    "hover:bg-muted/60",
                    isActive ? "bg-primary/10" : "bg-transparent"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-primary" />
                  )}
                  <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium leading-tight", isActive ? "text-primary" : "text-foreground")}>
                      {item.label}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <ChevronRight className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground/60")} />
                </button>
              );
            })}
          </nav>
        </CardContent>
      </Card>
    </div>
  );
}
