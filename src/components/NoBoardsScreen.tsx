import { useAuth } from "@/lib/auth";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useIsTeamAdmin } from "@/hooks/useTeamRole";
import { Bell, LogOut, LayoutGrid, User, Settings, Users, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import logoSomaLight from "@/assets/logo-soma.png";
import logoSomaDark from "@/assets/logo-soma-dark.png";
import { useTheme } from "next-themes";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function NoBoardsScreen() {
  const { user, signOut } = useAuth();
  const { currentTeam } = useSelectedTeam();
  const { isAdmin } = useIsTeamAdmin(currentTeam?.id ?? null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [logoutOpen, setLogoutOpen] = useState(false);
  const { resolvedTheme } = useTheme();
  const logoSrc = resolvedTheme === "dark" ? logoSomaLight : logoSomaDark;

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  return (
    <div className="flex h-[100dvh] w-full bg-sidebar p-2 md:p-3 overflow-hidden">
      <main className="flex-1 flex flex-col bg-background rounded-xl shadow-xl overflow-hidden">
        {/* Minimal header */}
        <header className="flex h-12 shrink-0 items-center justify-between px-4 border-b border-border rounded-t-xl">
          <div className="flex items-center gap-3 min-w-0">
            <img src={logoSrc} alt="SoMA" className="h-9 w-auto object-contain shrink-0" />
            {currentTeam?.name && (
              <>
                <span className="h-4 w-px bg-border shrink-0" aria-hidden="true" />
                <span className="text-sm font-medium text-foreground truncate hidden sm:inline">
                  {currentTeam.name}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-7 w-7 rounded-full p-0">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px]">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl shadow-lg border bg-popover/95 backdrop-blur-sm">
                <div className="flex items-center gap-2 p-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{profile?.full_name || "Usuário"}</span>
                    <span className="text-xs text-muted-foreground truncate max-w-[160px]">{user?.email}</span>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")}>
                  <User className="h-4 w-4 mr-2" />
                  Meu Perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")}>
                  <Settings className="h-4 w-4 mr-2" />
                  Configurações
                </DropdownMenuItem>
                {currentTeam && (
                  <DropdownMenuItem onClick={() => navigate(`/teams/${currentTeam.id}`)}>
                    <Users className="h-4 w-4 mr-2" />
                    Detalhes da Equipe
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLogoutOpen(true)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t("auth.logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Centered content */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-6 animate-fade-in">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <Bell className="h-9 w-9 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Aguardando alocação
              </h1>
              <p className="text-muted-foreground leading-relaxed">
                Você ainda não foi adicionado a nenhum quadro.
                Quando um administrador alocar você a um quadro, ele aparecerá automaticamente aqui.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70 pt-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Verificando em tempo real
            </div>

            {currentTeam && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/teams/${currentTeam.id}`)} className="gap-2">
                <Users className="h-4 w-4" />
                Ver detalhes da equipe
              </Button>
            )}

            {isAdmin && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground mb-3">
                  Como administrador, você pode criar um quadro:
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button onClick={() => navigate("/boards")} className="gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    Criar Quadro
                  </Button>
                </div>
              </div>
            )}

          </div>
        </div>
      </main>

      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("auth.logoutConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("auth.logoutDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={async () => {
                setLogoutOpen(false);
                await signOut();
              }}
            >
              {t("auth.logout")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
