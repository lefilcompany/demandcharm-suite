import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UserStats {
  totalDemands: number;
  deliveredDemands: number;
  inProgressDemands: number;
  totalComments: number;
  totalTimeSpent: number; // in seconds
  teamsCount: number;
  boardsCount: number;
  avgDeliveryTime: number; // in hours
}

export function useUserStats(userId: string | undefined) {
  return useQuery({
    queryKey: ["user-stats", userId],
    queryFn: async (): Promise<UserStats> => {
      if (!userId) throw new Error("User ID required");

      // Get demands created by user
      const { data: demands, error: demandsError } = await supabase
        .from("demands")
        .select(`
          id,
          created_at,
          delivered_at,
          status_id,
          demand_statuses(name)
        `)
        .eq("created_by", userId);

      if (demandsError) throw demandsError;

      // Get demands assigned to user
      const { data: assignedDemands, error: assignedError } = await supabase
        .from("demand_assignees")
        .select(`
          demand_id,
          demands!inner(
            id,
            created_at,
            delivered_at,
            status_id,
            demand_statuses(name)
          )
        `)
        .eq("user_id", userId);

      if (assignedError) throw assignedError;

      // Get comments count
      const { count: commentsCount, error: commentsError } = await supabase
        .from("demand_interactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("interaction_type", "comment");

      if (commentsError) throw commentsError;

      // Get time entries
      const { data: timeEntries, error: timeError } = await supabase
        .from("demand_time_entries")
        .select("duration_seconds")
        .eq("user_id", userId)
        .not("duration_seconds", "is", null);

      if (timeError) throw timeError;

      // Get teams count
      const { count: teamsCount, error: teamsError } = await supabase
        .from("team_members")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (teamsError) throw teamsError;

      // Get boards count
      const { count: boardsCount, error: boardsError } = await supabase
        .from("board_members")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      if (boardsError) throw boardsError;

      // Calculate stats
      const allDemands = [
        ...(demands || []),
        ...(assignedDemands?.map((a: any) => a.demands) || []),
      ];

      const uniqueDemands = Array.from(
        new Map(allDemands.map((d) => [d.id, d])).values()
      );

      const deliveredDemands = uniqueDemands.filter(
        (d: any) => d.delivered_at != null || d.demand_statuses?.name === "Entregue"
      ).length;

      const inProgressDemands = uniqueDemands.filter(
        (d: any) => d.delivered_at == null && d.demand_statuses?.name === "Em Andamento"
      ).length;

      const totalTimeSpent = (timeEntries || []).reduce(
        (sum, entry) => sum + (entry.duration_seconds || 0),
        0
      );

      // Calculate average delivery time
      const deliveredWithTime = uniqueDemands.filter(
        (d: any) => d.delivered_at && d.created_at
      );
      
      const avgDeliveryTime = deliveredWithTime.length > 0
        ? deliveredWithTime.reduce((sum, d: any) => {
            const created = new Date(d.created_at).getTime();
            const delivered = new Date(d.delivered_at).getTime();
            const hours = (delivered - created) / (1000 * 60 * 60);
            // Ignore invalid values (negative or > 1 year)
            if (hours < 0 || hours > 8760) return sum;
            return sum + hours;
          }, 0) / deliveredWithTime.filter((d: any) => {
            const created = new Date(d.created_at).getTime();
            const delivered = new Date(d.delivered_at).getTime();
            const hours = (delivered - created) / (1000 * 60 * 60);
            return hours >= 0 && hours <= 8760;
          }).length || 0
        : 0;

      return {
        totalDemands: uniqueDemands.length,
        deliveredDemands,
        inProgressDemands,
        totalComments: commentsCount || 0,
        totalTimeSpent,
        teamsCount: teamsCount || 0,
        boardsCount: boardsCount || 0,
        avgDeliveryTime: Math.round(avgDeliveryTime),
      };
    },
    enabled: !!userId,
  });
}

// Badge definitions
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  requirement: (stats: UserStats) => boolean;
}

export const badges: Badge[] = [
  // === DEMANDAS CRIADAS ===
  {
    id: "first_demand",
    name: "Primeira Demanda",
    description: "Criou sua primeira demanda",
    icon: "🎯",
    color: "#3B82F6",
    requirement: (stats) => stats.totalDemands >= 1,
  },
  {
    id: "three_demands",
    name: "Iniciante",
    description: "Criou 3 demandas",
    icon: "📝",
    color: "#60A5FA",
    requirement: (stats) => stats.totalDemands >= 3,
  },
  {
    id: "five_demands",
    name: "Produtivo",
    description: "Criou 5 demandas",
    icon: "📋",
    color: "#10B981",
    requirement: (stats) => stats.totalDemands >= 5,
  },
  {
    id: "ten_demands",
    name: "Super Produtivo",
    description: "Criou 10 demandas",
    icon: "🚀",
    color: "#8B5CF6",
    requirement: (stats) => stats.totalDemands >= 10,
  },
  {
    id: "twenty_demands",
    name: "Focado",
    description: "Criou 20 demandas",
    icon: "🎪",
    color: "#7C3AED",
    requirement: (stats) => stats.totalDemands >= 20,
  },
  {
    id: "veteran",
    name: "Veterano",
    description: "Criou 25 demandas",
    icon: "⭐",
    color: "#F97316",
    requirement: (stats) => stats.totalDemands >= 25,
  },
  {
    id: "legend",
    name: "Lenda",
    description: "Criou 50 demandas",
    icon: "👑",
    color: "#EAB308",
    requirement: (stats) => stats.totalDemands >= 50,
  },
  {
    id: "seventy_five_demands",
    name: "Elite",
    description: "Criou 75 demandas",
    icon: "🌟",
    color: "#F59E0B",
    requirement: (stats) => stats.totalDemands >= 75,
  },
  {
    id: "centurion",
    name: "Centurião",
    description: "Criou 100 demandas",
    icon: "🏛️",
    color: "#A855F7",
    requirement: (stats) => stats.totalDemands >= 100,
  },
  {
    id: "demand_titan",
    name: "Titã",
    description: "Criou 200 demandas",
    icon: "🗿",
    color: "#6D28D9",
    requirement: (stats) => stats.totalDemands >= 200,
  },
  {
    id: "demand_god",
    name: "Deus das Demandas",
    description: "Criou 500 demandas",
    icon: "⚜️",
    color: "#4C1D95",
    requirement: (stats) => stats.totalDemands >= 500,
  },

  // === ENTREGAS ===
  {
    id: "first_delivery",
    name: "Entregador",
    description: "Primeira entrega realizada",
    icon: "✅",
    color: "#22C55E",
    requirement: (stats) => stats.deliveredDemands >= 1,
  },
  {
    id: "five_deliveries",
    name: "Eficiente",
    description: "5 demandas entregues",
    icon: "📦",
    color: "#4ADE80",
    requirement: (stats) => stats.deliveredDemands >= 5,
  },
  {
    id: "ten_deliveries",
    name: "Mestre das Entregas",
    description: "10 demandas entregues",
    icon: "🏆",
    color: "#F59E0B",
    requirement: (stats) => stats.deliveredDemands >= 10,
  },
  {
    id: "twenty_deliveries",
    name: "Confiável",
    description: "20 demandas entregues",
    icon: "🤝",
    color: "#34D399",
    requirement: (stats) => stats.deliveredDemands >= 20,
  },
  {
    id: "delivery_expert",
    name: "Especialista",
    description: "25 demandas entregues",
    icon: "💎",
    color: "#06B6D4",
    requirement: (stats) => stats.deliveredDemands >= 25,
  },
  {
    id: "delivery_machine",
    name: "Máquina de Entregas",
    description: "50 demandas entregues",
    icon: "⚡",
    color: "#FACC15",
    requirement: (stats) => stats.deliveredDemands >= 50,
  },
  {
    id: "seventy_five_deliveries",
    name: "Incansável",
    description: "75 demandas entregues",
    icon: "🦾",
    color: "#84CC16",
    requirement: (stats) => stats.deliveredDemands >= 75,
  },
  {
    id: "delivery_god",
    name: "Deus das Entregas",
    description: "100 demandas entregues",
    icon: "🌈",
    color: "#059669",
    requirement: (stats) => stats.deliveredDemands >= 100,
  },
  {
    id: "delivery_titan",
    name: "Titã das Entregas",
    description: "200 demandas entregues",
    icon: "🔱",
    color: "#047857",
    requirement: (stats) => stats.deliveredDemands >= 200,
  },

  // === QUADROS ===
  {
    id: "first_board",
    name: "Primeiro Quadro",
    description: "Participa de 1 quadro",
    icon: "📌",
    color: "#818CF8",
    requirement: (stats) => stats.boardsCount >= 1,
  },
  {
    id: "two_boards",
    name: "Multi-Quadros",
    description: "Participa de 2 quadros",
    icon: "📍",
    color: "#A78BFA",
    requirement: (stats) => stats.boardsCount >= 2,
  },
  {
    id: "board_master",
    name: "Mestre dos Quadros",
    description: "Participa de 3 ou mais quadros",
    icon: "📊",
    color: "#6366F1",
    requirement: (stats) => stats.boardsCount >= 3,
  },
  {
    id: "board_explorer",
    name: "Explorador",
    description: "Participa de 5 ou mais quadros",
    icon: "🗺️",
    color: "#0EA5E9",
    requirement: (stats) => stats.boardsCount >= 5,
  },
  {
    id: "board_king",
    name: "Rei dos Quadros",
    description: "Participa de 10 ou mais quadros",
    icon: "🎯",
    color: "#4F46E5",
    requirement: (stats) => stats.boardsCount >= 10,
  },

  // === COMENTÁRIOS ===
  {
    id: "first_comment",
    name: "Primeiro Comentário",
    description: "Fez seu primeiro comentário",
    icon: "💭",
    color: "#F9A8D4",
    requirement: (stats) => stats.totalComments >= 1,
  },
  {
    id: "five_comments",
    name: "Participativo",
    description: "Fez 5 comentários",
    icon: "🗨️",
    color: "#F472B6",
    requirement: (stats) => stats.totalComments >= 5,
  },
  {
    id: "commentator",
    name: "Comunicador",
    description: "Fez 10 comentários",
    icon: "💬",
    color: "#EC4899",
    requirement: (stats) => stats.totalComments >= 10,
  },
  {
    id: "chatterbox",
    name: "Tagarela",
    description: "Fez 25 comentários",
    icon: "🗣️",
    color: "#DB2777",
    requirement: (stats) => stats.totalComments >= 25,
  },
  {
    id: "influencer",
    name: "Influenciador",
    description: "Fez 50 comentários",
    icon: "📢",
    color: "#E11D48",
    requirement: (stats) => stats.totalComments >= 50,
  },
  {
    id: "consistent_commenter",
    name: "Consistente",
    description: "Fez 75 comentários",
    icon: "🎤",
    color: "#BE185D",
    requirement: (stats) => stats.totalComments >= 75,
  },
  {
    id: "comment_master",
    name: "Mestre da Comunicação",
    description: "Fez 100 comentários",
    icon: "📣",
    color: "#9D174D",
    requirement: (stats) => stats.totalComments >= 100,
  },
  {
    id: "mega_commenter",
    name: "Mega Comunicador",
    description: "Fez 150 comentários",
    icon: "🎙️",
    color: "#831843",
    requirement: (stats) => stats.totalComments >= 150,
  },
  {
    id: "comment_legend",
    name: "Lenda da Comunicação",
    description: "Fez 200 comentários",
    icon: "📡",
    color: "#701A75",
    requirement: (stats) => stats.totalComments >= 200,
  },

  // === TEMPO ===
  {
    id: "first_hour",
    name: "Primeira Hora",
    description: "Registrou 1 hora de trabalho",
    icon: "⏰",
    color: "#5EEAD4",
    requirement: (stats) => stats.totalTimeSpent >= 3600,
  },
  {
    id: "five_hours",
    name: "Dedicado Iniciante",
    description: "Registrou 5 horas de trabalho",
    icon: "⌚",
    color: "#2DD4BF",
    requirement: (stats) => stats.totalTimeSpent >= 18000,
  },
  {
    id: "time_tracker",
    name: "Controlador de Tempo",
    description: "Registrou mais de 10 horas",
    icon: "⏱️",
    color: "#14B8A6",
    requirement: (stats) => stats.totalTimeSpent >= 36000,
  },
  {
    id: "fifteen_hours",
    name: "Comprometido",
    description: "Registrou 15 horas de trabalho",
    icon: "🕐",
    color: "#0D9488",
    requirement: (stats) => stats.totalTimeSpent >= 54000,
  },
  {
    id: "dedicated_worker",
    name: "Dedicado",
    description: "Registrou mais de 25 horas",
    icon: "💪",
    color: "#0F766E",
    requirement: (stats) => stats.totalTimeSpent >= 90000,
  },
  {
    id: "forty_hours",
    name: "Semana Completa",
    description: "Registrou 40 horas de trabalho",
    icon: "📅",
    color: "#115E59",
    requirement: (stats) => stats.totalTimeSpent >= 144000,
  },
  {
    id: "workaholic",
    name: "Workaholic",
    description: "Registrou mais de 50 horas",
    icon: "🔥",
    color: "#DC2626",
    requirement: (stats) => stats.totalTimeSpent >= 180000,
  },
  {
    id: "seventy_five_hours",
    name: "Maratonista",
    description: "Registrou 75 horas de trabalho",
    icon: "🏃‍♂️",
    color: "#B91C1C",
    requirement: (stats) => stats.totalTimeSpent >= 270000,
  },
  {
    id: "time_master",
    name: "Mestre do Tempo",
    description: "Registrou 100 horas de trabalho",
    icon: "⏳",
    color: "#991B1B",
    requirement: (stats) => stats.totalTimeSpent >= 360000,
  },
  {
    id: "time_legend",
    name: "Lenda do Tempo",
    description: "Registrou 200 horas de trabalho",
    icon: "🕰️",
    color: "#7F1D1D",
    requirement: (stats) => stats.totalTimeSpent >= 720000,
  },
  {
    id: "time_god",
    name: "Deus do Tempo",
    description: "Registrou 500 horas de trabalho",
    icon: "⌛",
    color: "#450A0A",
    requirement: (stats) => stats.totalTimeSpent >= 1800000,
  },

  // === VELOCIDADE ===
  {
    id: "fast_delivery",
    name: "Veloz",
    description: "Tempo médio de entrega menor que 24h",
    icon: "🏃",
    color: "#22D3EE",
    requirement: (stats) => stats.avgDeliveryTime > 0 && stats.avgDeliveryTime < 24,
  },
  {
    id: "lightning",
    name: "Relâmpago",
    description: "Tempo médio de entrega menor que 8h",
    icon: "⚡",
    color: "#FBBF24",
    requirement: (stats) => stats.avgDeliveryTime > 0 && stats.avgDeliveryTime < 8,
  },
  {
    id: "super_fast",
    name: "Super Veloz",
    description: "Tempo médio de entrega menor que 4h",
    icon: "💨",
    color: "#F97316",
    requirement: (stats) => stats.avgDeliveryTime > 0 && stats.avgDeliveryTime < 4,
  },
  {
    id: "instant",
    name: "Instantâneo",
    description: "Tempo médio de entrega menor que 2h",
    icon: "🌪️",
    color: "#EF4444",
    requirement: (stats) => stats.avgDeliveryTime > 0 && stats.avgDeliveryTime < 2,
  },
];

// Calculate level from XP (experience points)
export function calculateLevel(stats: UserStats): { level: number; xp: number; xpForNext: number; progress: number } {
  // XP calculation
  const xp = 
    stats.totalDemands * 10 +
    stats.deliveredDemands * 25 +
    stats.totalComments * 5 +
    Math.floor(stats.totalTimeSpent / 3600) * 20 +
    stats.teamsCount * 20 +
    stats.boardsCount * 10;

  // Level calculation (exponential curve)
  const level = Math.floor(Math.sqrt(xp / 100)) + 1;
  const xpForCurrentLevel = Math.pow(level - 1, 2) * 100;
  const xpForNextLevel = Math.pow(level, 2) * 100;
  const progress = ((xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100;

  return {
    level,
    xp,
    xpForNext: xpForNextLevel,
    progress: Math.min(100, Math.max(0, progress)),
  };
}
