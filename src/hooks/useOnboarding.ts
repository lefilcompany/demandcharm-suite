import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useTeamRole } from "@/hooks/useTeamRole";
import { useSelectedTeam } from "@/contexts/TeamContext";
import type { TourStep } from "@/components/OnboardingTour";

// Tour steps for each role
const ADMIN_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: "[data-tour='dashboard-title']",
    title: "Bem-vindo ao SoMA!",
    content: "Este é o seu painel principal onde você pode visualizar o resumo de todas as demandas da sua equipe.",
    placement: "bottom",
  },
  {
    id: "sidebar",
    target: "[data-tour='sidebar']",
    title: "Menu de Navegação",
    content: "Use o menu lateral para navegar entre as diferentes seções do sistema. Clique no ícone para expandir ou recolher.",
    placement: "right",
  },
  {
    id: "kanban",
    target: "[data-tour='kanban-link']",
    title: "Quadro Kanban",
    content: "Visualize e gerencie suas demandas em um quadro Kanban interativo. Arraste e solte para atualizar status.",
    placement: "right",
  },
  {
    id: "demands",
    target: "[data-tour='demands-link']",
    title: "Lista de Demandas",
    content: "Acesse todas as demandas em formato de tabela com filtros avançados e opções de exportação.",
    placement: "right",
  },
  {
    id: "teams",
    target: "[data-tour='teams-link']",
    title: "Gerenciar Equipes",
    content: "Como administrador, você pode gerenciar membros, aprovar solicitações e configurar serviços.",
    placement: "right",
  },
  {
    id: "services",
    target: "[data-tour='services-link']",
    title: "Serviços",
    content: "Configure os tipos de serviço com prazos estimados para automatizar o cálculo de deadlines.",
    placement: "right",
  },
  {
    id: "new-demand",
    target: "[data-tour='new-demand-btn']",
    title: "Criar Nova Demanda",
    content: "Clique aqui para criar uma nova demanda. Você pode usar templates salvos para agilizar o processo.",
    placement: "bottom",
  },
  {
    id: "notifications",
    target: "[data-tour='notifications-btn']",
    title: "Notificações",
    content: "Receba alertas sobre novas demandas, mudanças de status e solicitações de ajuste em tempo real.",
    placement: "bottom",
  },
];

const MODERATOR_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: "[data-tour='dashboard-title']",
    title: "Bem-vindo, Coordenador!",
    content: "Este é o seu painel de controle. Aqui você acompanha o progresso das demandas da equipe.",
    placement: "bottom",
  },
  {
    id: "kanban",
    target: "[data-tour='kanban-link']",
    title: "Quadro Kanban",
    content: "Gerencie o fluxo de trabalho arrastando demandas entre as colunas de status.",
    placement: "right",
  },
  {
    id: "demands",
    target: "[data-tour='demands-link']",
    title: "Lista de Demandas",
    content: "Visualize demandas em formato de tabela, aplique filtros e exporte relatórios.",
    placement: "right",
  },
  {
    id: "services",
    target: "[data-tour='services-link']",
    title: "Configurar Serviços",
    content: "Defina os tipos de serviço disponíveis e seus prazos estimados de conclusão.",
    placement: "right",
  },
  {
    id: "adjustments",
    target: "[data-tour='adjustments-link']",
    title: "Solicitações de Ajuste",
    content: "Acompanhe as demandas que precisam de ajustes solicitados pelos clientes.",
    placement: "right",
  },
];

const EXECUTOR_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: "[data-tour='dashboard-title']",
    title: "Bem-vindo, Agente!",
    content: "Este é o seu espaço de trabalho. Aqui você visualiza as demandas atribuídas a você.",
    placement: "bottom",
  },
  {
    id: "kanban",
    target: "[data-tour='kanban-link']",
    title: "Seu Quadro de Trabalho",
    content: "Visualize e atualize o status das demandas arrastando os cards entre as colunas.",
    placement: "right",
  },
  {
    id: "demands",
    target: "[data-tour='demands-link']",
    title: "Suas Demandas",
    content: "Acesse a lista completa de demandas e use filtros para encontrar rapidamente o que precisa.",
    placement: "right",
  },
  {
    id: "adjustments",
    target: "[data-tour='adjustments-link']",
    title: "Ajustes Pendentes",
    content: "Veja demandas que precisam de ajustes e trabalhe nelas rapidamente.",
    placement: "right",
  },
];

const REQUESTER_TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: "[data-tour='dashboard-title']",
    title: "Bem-vindo ao SoMA!",
    content: "Este é o seu painel onde você acompanha suas demandas e visualiza o progresso dos serviços.",
    placement: "bottom",
  },
  {
    id: "scope",
    target: "[data-tour='scope-progress']",
    title: "Uso do Escopo",
    content: "Acompanhe quantas demandas você já criou este mês em relação ao seu limite contratado.",
    placement: "bottom",
  },
  {
    id: "new-demand",
    target: "[data-tour='new-demand-btn']",
    title: "Criar Nova Demanda",
    content: "Clique aqui para solicitar um novo serviço. Preencha o formulário com os detalhes da sua solicitação.",
    placement: "bottom",
  },
  {
    id: "kanban",
    target: "[data-tour='kanban-link']",
    title: "Acompanhar Progresso",
    content: "Visualize o andamento das suas demandas no quadro Kanban (somente leitura).",
    placement: "right",
  },
  {
    id: "demands",
    target: "[data-tour='demands-link']",
    title: "Histórico de Demandas",
    content: "Acesse todas as suas demandas anteriores e acompanhe o status de cada uma.",
    placement: "right",
  },
];

export function useOnboarding() {
  const { user } = useAuth();
  const { selectedTeamId } = useSelectedTeam();
  const { data: role } = useTeamRole(selectedTeamId);
  const [isOpen, setIsOpen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(true); // Default true to prevent flash
  const [isLoading, setIsLoading] = useState(true);

  // Get tour steps based on role
  const getTourSteps = useCallback((): TourStep[] => {
    // With the new model, tour is generic since team role is just owner/member
    // Board-level roles determine specific features
    return ADMIN_TOUR_STEPS;
  }, [role]);

  // Check if user has completed onboarding
  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    // Fast localStorage check first
    if (localStorage.getItem(`onboarding_completed_${user.id}`) === 'true') {
      setHasCompleted(true);
      setIsLoading(false);
      return;
    }

    const checkOnboardingStatus = async () => {
      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .select("preference_value")
          .eq("user_id", user.id)
          .eq("preference_key", "onboarding_completed")
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Error checking onboarding status:", error);
        }

        const completed = data?.preference_value as { completed?: boolean } | null;
        const hasCompletedOnboarding = completed?.completed === true;
        
        setHasCompleted(hasCompletedOnboarding);
        
        if (hasCompletedOnboarding) {
          localStorage.setItem(`onboarding_completed_${user.id}`, 'true');
        } else {
          setTimeout(() => setIsOpen(true), 1000);
        }
      } catch (error) {
        console.error("Error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user?.id]);

  // Mark onboarding as complete
  const completeOnboarding = useCallback(async () => {
    if (!user?.id) return;

    setIsOpen(false);
    setHasCompleted(true);
    localStorage.setItem(`onboarding_completed_${user.id}`, 'true');

    try {
      const { data: existing } = await supabase
        .from("user_preferences")
        .select("id")
        .eq("user_id", user.id)
        .eq("preference_key", "onboarding_completed")
        .single();

      if (existing) {
        await supabase
          .from("user_preferences")
          .update({
            preference_value: { completed: true },
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("user_preferences")
          .insert({
            user_id: user.id,
            preference_key: "onboarding_completed",
            preference_value: { completed: true },
          });
      }
    } catch (error) {
      console.error("Error saving onboarding status:", error);
    }
  }, [user?.id]);

  // Reset onboarding (for testing or re-watching)
  const resetOnboarding = useCallback(async (navigateFn?: () => void) => {
    if (!user?.id) return;

    try {
      await supabase
        .from("user_preferences")
        .delete()
        .eq("user_id", user.id)
        .eq("preference_key", "onboarding_completed");

      localStorage.removeItem(`onboarding_completed_${user.id}`);
      setHasCompleted(false);
      
      if (navigateFn) {
        navigateFn();
      }
      
      setTimeout(() => setIsOpen(true), 150);
    } catch (error) {
      console.error("Error resetting onboarding:", error);
    }
  }, [user?.id]);

  const startTour = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeTour = useCallback(() => {
    setIsOpen(false);
  }, []);

  return {
    isOpen,
    isLoading,
    hasCompleted,
    steps: getTourSteps(),
    startTour,
    closeTour,
    completeOnboarding,
    resetOnboarding,
  };
}
