import { useTranslation } from "react-i18next";
import { Plus, LayoutGrid } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCreateDemandModal } from "@/contexts/CreateDemandContext";
import { Button } from "@/components/ui/button";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useTeamRole } from "@/hooks/useTeamRole";
import { useSelectedBoardSafe } from "@/contexts/BoardContext";
import { useBoardRole } from "@/hooks/useBoardMembers";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreateBoardDialog } from "@/components/CreateBoardDialog";

export function FloatingCreateButton() {
  return null;
}
