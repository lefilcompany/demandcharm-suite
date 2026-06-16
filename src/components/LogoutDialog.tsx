import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface LogoutDialogProps {
  isCollapsed?: boolean;
  isMobile?: boolean;
}

export function LogoutDialog({ isCollapsed, isMobile }: LogoutDialogProps) {
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();
  const { t } = useTranslation();

  const handleLogout = async () => {
    await signOut();
    setOpen(false);
  };

  const showText = isMobile || !isCollapsed;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <SidebarMenuButton 
          tooltip={t("auth.logout")} 
          size={isMobile ? "lg" : "default"}
          className="w-full hover:bg-sidebar-accent transition-colors min-h-[44px] md:min-h-0"
        >
          <LogOut className="h-5 w-5 md:h-4 md:w-4" />
          {showText && <span className="text-base md:text-sm">{t("auth.logout")}</span>}
        </SidebarMenuButton>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("auth.logoutConfirm")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("auth.logoutDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {t("auth.logout")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
