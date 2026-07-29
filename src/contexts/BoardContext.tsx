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

  // Keep the persisted board selection aligned with the selected team and accessible boards.
  useEffect(() => {
    if (!selectedTeamId) {
      if (selectedBoardId !== null) {
        setSelectedBoardId(null);
      }
      return;
    }

    if (!boards) return;

    if (boards.length === 0) {
      if (selectedBoardId !== null) {
        setSelectedBoardId(null);
      }
      return;
    }

    const currentBoardInTeam = boards.some((board) => board.id === selectedBoardId);
    if (!currentBoardInTeam) {
      setSelectedBoardId(boards[0].id);
    }
  }, [boards, selectedBoardId, selectedTeamId]);

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
