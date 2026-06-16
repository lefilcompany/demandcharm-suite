// Profile customization helpers: visibility map and banner gradient presets
export type ProfileFieldKey =
  | "banner"
  | "jobTitle"
  | "location"
  | "bio"
  | "website"
  | "linkedin"
  | "github"
  | "level"
  | "statDemands"
  | "statDelivered"
  | "statTime"
  | "statComments"
  | "statTeams"
  | "statBoards"
  | "statCompletion"
  | "statRecent"
  | "achievements"
  | "demandHistory"
  | "teams"
  | "boards";

export interface ProfileFieldDef {
  key: ProfileFieldKey;
  label: string;
  group: "header" | "info" | "social" | "stats" | "sections";
}

export const PROFILE_FIELDS: ProfileFieldDef[] = [
  { key: "banner", label: "Banner personalizado", group: "header" },
  { key: "level", label: "Nível e XP", group: "header" },

  { key: "jobTitle", label: "Cargo / função", group: "info" },
  { key: "location", label: "Localização", group: "info" },
  { key: "bio", label: "Bio", group: "info" },

  { key: "website", label: "Website", group: "social" },
  { key: "linkedin", label: "LinkedIn", group: "social" },
  { key: "github", label: "GitHub", group: "social" },

  { key: "statDemands", label: "Card: Demandas", group: "stats" },
  { key: "statDelivered", label: "Card: Entregues", group: "stats" },
  { key: "statTime", label: "Card: Tempo trabalhado", group: "stats" },
  { key: "statComments", label: "Card: Comentários", group: "stats" },
  { key: "statTeams", label: "Indicador: Equipes", group: "stats" },
  { key: "statBoards", label: "Indicador: Quadros", group: "stats" },
  { key: "statCompletion", label: "Indicador: Taxa de conclusão", group: "stats" },
  { key: "statRecent", label: "Indicador: Atividade recente", group: "stats" },

  { key: "demandHistory", label: "Histórico de demandas", group: "sections" },
  { key: "achievements", label: "Conquistas", group: "sections" },
  { key: "teams", label: "Lista de equipes", group: "sections" },
  { key: "boards", label: "Lista de quadros", group: "sections" },
];

export const GROUP_LABELS: Record<ProfileFieldDef["group"], string> = {
  header: "Cabeçalho",
  info: "Informações pessoais",
  social: "Redes sociais",
  stats: "Estatísticas e indicadores",
  sections: "Seções do perfil",
};

export const DEFAULT_VISIBILITY: Record<ProfileFieldKey, boolean> =
  PROFILE_FIELDS.reduce((acc, f) => {
    acc[f.key] = true;
    return acc;
  }, {} as Record<ProfileFieldKey, boolean>);

export function resolveVisibility(
  raw: unknown,
  isOwn: boolean,
): Record<ProfileFieldKey, boolean> {
  // Owner always sees everything in own profile
  if (isOwn) return { ...DEFAULT_VISIBILITY };
  const map = { ...DEFAULT_VISIBILITY };
  if (raw && typeof raw === "object") {
    for (const k of Object.keys(map) as ProfileFieldKey[]) {
      const v = (raw as any)[k];
      if (typeof v === "boolean") map[k] = v;
    }
  }
  return map;
}

export interface BannerGradient {
  id: string;
  label: string;
  className: string;
}

export const BANNER_GRADIENTS: BannerGradient[] = [
  {
    id: "soma-orange",
    label: "SoMA Laranja",
    className: "bg-gradient-to-br from-[#F28705] via-[#F28705]/80 to-[#1D1D1D]/70",
  },
  {
    id: "dark",
    label: "Dark",
    className: "bg-gradient-to-br from-[#1D1D1D] via-[#2a2a2a] to-[#0a0a0a]",
  },
  {
    id: "sunset",
    label: "Pôr do sol",
    className: "bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600",
  },
  {
    id: "ocean",
    label: "Oceano",
    className: "bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-500",
  },
  {
    id: "forest",
    label: "Floresta",
    className: "bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700",
  },
  {
    id: "violet",
    label: "Violeta",
    className: "bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-600",
  },
  {
    id: "rose",
    label: "Rosé",
    className: "bg-gradient-to-br from-rose-400 via-pink-500 to-red-500",
  },
  {
    id: "midnight",
    label: "Meia-noite",
    className: "bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900",
  },
];

export function getBannerGradient(id?: string | null): BannerGradient {
  return (
    BANNER_GRADIENTS.find((g) => g.id === id) || BANNER_GRADIENTS[0]
  );
}
