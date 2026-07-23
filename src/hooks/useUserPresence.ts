import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface PresenceState {
  [key: string]: {
    user_id: string;
    online_at: string;
  }[];
}

export function useUserPresence(channelName: string = "online-users") {
  const [user, setUser] = useState<User | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(false);

  // Track auth state without depending on AuthProvider so this hook stays safe
  // even when mounted outside the AuthContext (e.g. stale bundles / SW cache).
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setUser(data.session?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

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
