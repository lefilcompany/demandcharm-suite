import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

interface PresenceState {
  [key: string]: {
    user_id: string;
    online_at: string;
  }[];
}

export function useUserPresence(channelName: string = "online-users") {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(channelName);

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as PresenceState;
        const users = new Set<string>();
        
        Object.values(state).forEach((presences) => {
          presences.forEach((presence) => {
            users.add(presence.user_id);
          });
        });
        
        setOnlineUsers(users);
        console.log("Presence sync:", users);
      })
      .on("presence", { event: "join" }, ({ newPresences }) => {
        console.log("User joined:", newPresences);
      })
      .on("presence", { event: "leave" }, ({ leftPresences }) => {
        console.log("User left:", leftPresences);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          await channel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [user, channelName]);

  const isUserOnline = (userId: string) => onlineUsers.has(userId);

  return { onlineUsers, isUserOnline, isConnected };
}
