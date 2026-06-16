import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useTeams } from "@/hooks/useTeams";

interface Team {
  id: string;
  name: string;
  description: string | null;
  access_code: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface TeamContextType {
  selectedTeamId: string | null;
  setSelectedTeamId: (id: string | null) => void;
  teams: Team[] | undefined;
  currentTeam: Team | undefined;
  hasTeams: boolean;
  isLoading: boolean;
}

export const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: ReactNode }) {
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(() => {
    return localStorage.getItem("selectedTeamId");
  });
  const { data: teams, isLoading } = useTeams();

  useEffect(() => {
    if (selectedTeamId) {
      localStorage.setItem("selectedTeamId", selectedTeamId);
    } else {
      localStorage.removeItem("selectedTeamId");
    }
  }, [selectedTeamId]);

  // Auto-select first team if none selected
  useEffect(() => {
    if (!selectedTeamId && teams && teams.length > 0) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  // Clear selection if selected team no longer exists
  useEffect(() => {
    if (selectedTeamId && teams && teams.length > 0) {
      const teamExists = teams.some(team => team.id === selectedTeamId);
      if (!teamExists) {
        setSelectedTeamId(teams[0].id);
      }
    }
  }, [teams, selectedTeamId]);

  const hasTeams = Boolean(teams && teams.length > 0);
  const currentTeam = teams?.find(team => team.id === selectedTeamId);

  return (
    <TeamContext.Provider value={{ selectedTeamId, setSelectedTeamId, teams, currentTeam, hasTeams, isLoading }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useSelectedTeam() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    // Return safe defaults instead of throwing to prevent blank screens
    // This can happen during HMR/hot reload or stale cache scenarios
    console.warn("useSelectedTeam called outside TeamProvider - returning defaults");
    return {
      selectedTeamId: null,
      setSelectedTeamId: () => {},
      teams: undefined,
      currentTeam: undefined,
      hasTeams: false,
      isLoading: true,
    } as TeamContextType;
  }
  return context;
}
