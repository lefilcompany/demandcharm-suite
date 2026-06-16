import { createContext, useContext, ReactNode } from "react";
import { useUserPresence } from "@/hooks/useUserPresence";

interface PresenceContextType {
  onlineUsers: Set<string>;
  isUserOnline: (userId: string) => boolean;
  isConnected: boolean;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const presence = useUserPresence();

  return (
    <PresenceContext.Provider value={presence}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (context === undefined) {
    throw new Error("usePresence must be used within a PresenceProvider");
  }
  return context;
}
