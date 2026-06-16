import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { RealtimeChannel } from "@supabase/supabase-js";

interface PresenceUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  online_at: string;
}

export function useDemandPresence(demandId?: string) {
  const { user } = useAuth();
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!user || !demandId) return;

    let channel: RealtimeChannel | null = null;
    let isMounted = true;

    const setupPresence = async () => {
      // Get current user's profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single();

      if (!isMounted) return;

      const userStatus = {
        id: user.id,
        full_name: profile?.full_name || "Usuário",
        avatar_url: profile?.avatar_url || null,
        online_at: new Date().toISOString(),
      };

      channel = supabase.channel(`demand-presence-${demandId}`);

      channel
        .on("presence", { event: "sync" }, () => {
          if (!isMounted) return;
          const state = channel?.presenceState() || {};
          const users: PresenceUser[] = [];
          
          Object.values(state).forEach((presences: any) => {
            presences.forEach((presence: PresenceUser) => {
              // Don't include current user in the list
              if (presence.id !== user.id) {
                users.push(presence);
              }
            });
          });
          
          setPresenceUsers(users);
        })
        .on("presence", { event: "join" }, ({ newPresences }) => {
          console.log("User joined demand view:", newPresences);
        })
        .on("presence", { event: "leave" }, ({ leftPresences }) => {
          console.log("User left demand view:", leftPresences);
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && isMounted) {
            setIsConnected(true);
            await channel?.track(userStatus);
          }
        });
    };

    setupPresence();

    return () => {
      isMounted = false;
      if (channel) {
        channel.untrack();
        supabase.removeChannel(channel);
      }
    };
  }, [user, demandId]);

  return { presenceUsers, isConnected };
}
