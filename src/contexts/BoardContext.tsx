import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useBoards, Board } from "@/hooks/useBoards";
import { TeamContext } from "@/contexts/TeamContext";

interface BoardContextType {
  selectedBoardId: string | null;
  setSelectedBoardId: (id: string | null) => void;
  boards: Board[] | undefined;
  currentBoard: Board | undefined;
  currentTeamId: string | null;
  hasBoards: boolean;
  isLoading: boolean;
}

const BoardContext = createContext<BoardContextType | undefined>(undefined);

export function BoardProvider({ children }: { children: ReactNode }) {
  // Use TeamContext directly to avoid the throwing hook during initialization
  const teamContext = useContext(TeamContext);
  const selectedTeamId = teamContext?.selectedTeamId ?? null;
  
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(() => {
    return localStorage.getItem("selectedBoardId");
  });

  const { data: boards, isLoading } = useBoards(selectedTeamId);

  // Persist selection to localStorage
  useEffect(() => {
    if (selectedBoardId) {
      localStorage.setItem("selectedBoardId", selectedBoardId);
    } else {
      localStorage.removeItem("selectedBoardId");
    }
  }, [selectedBoardId]);

  // Auto-select default board when team changes or no board selected
  useEffect(() => {
    if (boards && boards.length > 0) {
      // Check if currently selected board belongs to current team
      const currentBoardInTeam = boards.find((b) => b.id === selectedBoardId);

      if (!currentBoardInTeam) {
        const defaultBoard = boards[0];
        setSelectedBoardId(defaultBoard.id);
      }
    }
  }, [boards, selectedBoardId, selectedTeamId]);

  // Clear board selection when team changes
  useEffect(() => {
    if (selectedTeamId) {
      // Will be auto-selected by the effect above
    } else {
      setSelectedBoardId(null);
    }
  }, [selectedTeamId]);

  const currentBoard = boards?.find((b) => b.id === selectedBoardId);
  const currentTeamId = currentBoard?.team_id ?? selectedTeamId;
  const hasBoards = Boolean(boards && boards.length > 0);

  return (
    <BoardContext.Provider
      value={{
        selectedBoardId,
        setSelectedBoardId,
        boards,
        currentBoard,
        currentTeamId,
        hasBoards,
        isLoading,
      }}
    >
      {children}
    </BoardContext.Provider>
  );
}

export function useSelectedBoard() {
  const context = useContext(BoardContext);
  if (context === undefined) {
    throw new Error("useSelectedBoard must be used within a BoardProvider");
  }
  return context;
}

// Safe version that doesn't throw - returns null values when outside provider
export function useSelectedBoardSafe() {
  const context = useContext(BoardContext);
  if (context === undefined) {
    return {
      selectedBoardId: null,
      setSelectedBoardId: () => {},
      boards: undefined,
      currentBoard: undefined,
      currentTeamId: null,
      hasBoards: false,
      isLoading: false,
    };
  }
  return context;
}
