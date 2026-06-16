import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InternalApprover {
  id: string; // synthetic id (member id or "owner-<uid>")
  user_id: string;
  role: "admin" | "moderator" | "owner"; // "owner" = team owner (team_members.role='admin')
  profile?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    email: string | null;
    job_title: string | null;
  };
}

/**
 * Returns the eligible internal approvers for a board:
 *  - Board admins + moderators (from board_members)
 *  - Team owners (team_members.role='admin') of the board's team, even if not in the board
 * Deduplicated by user_id. Board role takes precedence over owner role for display.
 */
export function useInternalApprovers(boardId: string | null | undefined) {
  return useQuery({
    queryKey: ["internal-approvers", boardId],
    enabled: !!boardId,
    queryFn: async (): Promise<InternalApprover[]> => {
      // 1) Board admins/moderators
      const { data: boardMembers, error: bmErr } = await supabase
        .from("board_members")
        .select(`
          id,
          user_id,
          role,
          profiles:user_id ( id, full_name, avatar_url, email, job_title )
        `)
        .eq("board_id", boardId as string)
        .in("role", ["admin", "moderator"]);
      if (bmErr) throw bmErr;

      // 2) Find the team_id of this board
      const { data: board, error: bErr } = await supabase
        .from("boards")
        .select("team_id")
        .eq("id", boardId as string)
        .maybeSingle();
      if (bErr) throw bErr;

      let owners: any[] = [];
      if (board?.team_id) {
        const { data: teamOwners, error: toErr } = await supabase
          .from("team_members")
          .select(`
            user_id,
            profiles:user_id ( id, full_name, avatar_url, email, job_title )
          `)
          .eq("team_id", board.team_id)
          .eq("role", "admin");
        if (toErr) throw toErr;
        owners = teamOwners || [];
      }

      const map = new Map<string, InternalApprover>();
      // Owners first
      for (const o of owners) {
        map.set(o.user_id, {
          id: `owner-${o.user_id}`,
          user_id: o.user_id,
          role: "owner",
          profile: o.profiles,
        });
      }
      // Board admins/moderators override (display board role when both)
      for (const m of (boardMembers || []) as any[]) {
        map.set(m.user_id, {
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          profile: m.profiles,
        });
      }

      const order: Record<string, number> = { owner: 0, admin: 1, moderator: 2 };
      return Array.from(map.values()).sort((a, b) => {
        const oa = order[a.role] ?? 99;
        const ob = order[b.role] ?? 99;
        if (oa !== ob) return oa - ob;
        return (a.profile?.full_name || "").localeCompare(b.profile?.full_name || "");
      });
    },
  });
}
