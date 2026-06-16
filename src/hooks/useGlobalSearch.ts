import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SearchResult {
  type: "demand" | "member" | "user";
  id: string;
  title: string;
  subtitle?: string;
  extra?: string;
  link: string;
  avatarUrl?: string;
  priority?: string;
  statusColor?: string;
}

export function useGlobalSearch(query: string, boardId: string | null) {
  return useQuery({
    queryKey: ["global-search", query, boardId],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!query || query.length < 2) return [];
      
      const results: SearchResult[] = [];
      const searchTerm = `%${query}%`;
      
      // Check if query looks like a demand code (e.g., "EQUIPE-123" or just "123")
      const codeMatch = query.match(/^(?:([A-Za-z\u00C0-\u024F]+)-)?(\d+)$/);
      const sequenceNumber = codeMatch ? parseInt(codeMatch[2], 10) : null;
      const isNumericOnly = /^\d+$/.test(query.trim());
      
      // Search demands across ALL boards the user has access to
      let demandsQuery = supabase
        .from("demands")
        .select(`
          id, title, description, priority, board_sequence_number, 
          board_id, archived,
          boards(name),
          demand_statuses:status_id(name, color),
          profiles:assigned_to(full_name),
          services:service_id(name)
        `)
        .eq("archived", false);

      // If a board is selected, prioritize it but still search all
      // Build the OR filter for flexible matching
      const orFilters: string[] = [];
      
      // Always search by title and description
      orFilters.push(`title.ilike.${searchTerm}`);
      orFilters.push(`description.ilike.${searchTerm}`);
      
      // If it's a number, also match by sequence number
      if (sequenceNumber !== null) {
        orFilters.push(`board_sequence_number.eq.${sequenceNumber}`);
      }

      demandsQuery = demandsQuery.or(orFilters.join(","));
      
      const { data: demands } = await demandsQuery.order("updated_at", { ascending: false }).limit(15);
      
      if (demands) {
        // Sort: current board demands first, then others
        const sorted = [...demands].sort((a, b) => {
          if (boardId) {
            if (a.board_id === boardId && b.board_id !== boardId) return -1;
            if (a.board_id !== boardId && b.board_id === boardId) return 1;
          }
          return 0;
        });

        results.push(
          ...sorted.map((d) => {
            const boardName = (d.boards as any)?.name || "EQUIPE";
            const code = d.board_sequence_number ? `${boardName}-${d.board_sequence_number}` : boardName;
            const statusName = (d.demand_statuses as any)?.name || "";
            const statusColor = (d.demand_statuses as any)?.color || "";
            const assigneeName = (d.profiles as any)?.full_name || null;
            const serviceName = (d.services as any)?.name || null;
            
            // Build a rich subtitle
            const parts: string[] = [code];
            if (statusName) parts.push(statusName);
            if (assigneeName) parts.push(assigneeName);
            
            // Extra line with service
            const extraParts: string[] = [];
            if (serviceName) extraParts.push(serviceName);
            if (d.priority) extraParts.push(d.priority);

            return {
              type: "demand" as const,
              id: d.id,
              title: d.title,
              subtitle: parts.join(" · "),
              extra: extraParts.length > 0 ? extraParts.join(" · ") : undefined,
              link: `/demands/${d.id}`,
              priority: d.priority || undefined,
              statusColor: statusColor || undefined,
            };
          })
        );
      }
      
      // Search board members (only if a board is selected)
      if (boardId) {
        const { data: boardMembers } = await supabase
          .from("board_members")
          .select("user_id, profiles(id, full_name, avatar_url, job_title)")
          .eq("board_id", boardId);
        
        if (boardMembers) {
          const matchingMembers = boardMembers
            .filter((bm) => {
              const profile = bm.profiles as any;
              return profile?.full_name?.toLowerCase().includes(query.toLowerCase());
            })
            .slice(0, 5);
          
          results.push(
            ...matchingMembers.map((bm) => {
              const profile = bm.profiles as any;
              return {
                type: "member" as const,
                id: profile.id,
                title: profile.full_name,
                subtitle: profile.job_title || "Membro do quadro",
                link: `/user/${profile.id}`,
                avatarUrl: profile.avatar_url || undefined,
              };
            })
          );
        }
      }
      
      // Search all users/profiles
      const { data: users } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, job_title")
        .ilike("full_name", searchTerm)
        .limit(5);
      
      if (users) {
        const existingIds = results.filter(r => r.type === "member").map(r => r.id);
        const newUsers = users.filter(u => !existingIds.includes(u.id));
        
        results.push(
          ...newUsers.map((u) => ({
            type: "user" as const,
            id: u.id,
            title: u.full_name || "Usuário",
            subtitle: u.job_title || "Usuário do sistema",
            link: `/user/${u.id}`,
            avatarUrl: u.avatar_url || undefined,
          }))
        );
      }
      
      return results;
    },
    enabled: query.length >= 2,
    staleTime: 1000,
  });
}
