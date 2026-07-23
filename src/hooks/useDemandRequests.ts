import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useSelectedTeam } from "@/contexts/TeamContext";
import { useSelectedBoardSafe } from "@/contexts/BoardContext";
import { sendDemandRequestPushNotification } from "./useSendPushNotification";

interface DemandRequest {
  id: string;
  team_id: string;
  board_id: string | null;
  created_by: string;
  title: string;
  description: string | null;
  priority: string | null;
  service_id: string | null;
  status: "pending" | "approved" | "rejected" | "returned";
  rejection_reason: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  creator?: {
    full_name: string;
    avatar_url: string | null;
  };
  responder?: {
    full_name: string;
  } | null;
  service?: {
    name: string;
    estimated_hours: number;
  } | null;
  board?: {
    name: string;
  } | null;
}

// Fetch pending requests for admins/moderators - filtered by board
export function usePendingDemandRequests() {
  const { selectedBoardId } = useSelectedBoardSafe();

  return useQuery({
    queryKey: ["demand-requests", "pending", selectedBoardId],
    queryFn: async () => {
      if (!selectedBoardId) return [];

      const { data, error } = await supabase
        .from("demand_requests")
        .select(`
          *,
          creator:profiles!demand_requests_created_by_fkey(full_name, avatar_url),
          service:services(name, estimated_hours),
          board:boards(name)
        `)
        .eq("board_id", selectedBoardId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DemandRequest[];
    },
    enabled: !!selectedBoardId,
  });
}

// Fetch approved requests - filtered by board
export function useApprovedDemandRequests() {
  const { selectedBoardId } = useSelectedBoardSafe();

  return useQuery({
    queryKey: ["demand-requests", "approved", selectedBoardId],
    queryFn: async () => {
      if (!selectedBoardId) return [];

      const { data, error } = await supabase
        .from("demand_requests")
        .select(`
          *,
          creator:profiles!demand_requests_created_by_fkey(full_name, avatar_url),
          responder:profiles!demand_requests_responded_by_fkey(full_name, avatar_url),
          service:services(name, estimated_hours),
          board:boards(name)
        `)
        .eq("board_id", selectedBoardId)
        .eq("status", "approved")
        .order("responded_at", { ascending: false });

      if (error) throw error;
      return data as DemandRequest[];
    },
    enabled: !!selectedBoardId,
  });
}

// Fetch returned requests - filtered by board
export function useReturnedDemandRequests() {
  const { selectedBoardId } = useSelectedBoardSafe();

  return useQuery({
    queryKey: ["demand-requests", "returned", selectedBoardId],
    queryFn: async () => {
      if (!selectedBoardId) return [];

      const { data, error } = await supabase
        .from("demand_requests")
        .select(`
          *,
          creator:profiles!demand_requests_created_by_fkey(full_name, avatar_url),
          responder:profiles!demand_requests_responded_by_fkey(full_name, avatar_url),
          service:services(name, estimated_hours),
          board:boards(name)
        `)
        .eq("board_id", selectedBoardId)
        .eq("status", "returned")
        .order("responded_at", { ascending: false });

      if (error) throw error;
      return data as DemandRequest[];
    },
    enabled: !!selectedBoardId,
  });
}

// Fetch user's own requests (for Solicitantes) - filtered by board
export function useMyDemandRequests() {
  const { user } = useAuth();
  const { selectedBoardId } = useSelectedBoardSafe();

  return useQuery({
    queryKey: ["demand-requests", "my", user?.id, selectedBoardId],
    queryFn: async () => {
      if (!user || !selectedBoardId) return [];

      const { data, error } = await supabase
        .from("demand_requests")
        .select(`
          *,
          creator:profiles!demand_requests_created_by_fkey(full_name, avatar_url),
          responder:profiles!demand_requests_responded_by_fkey(full_name),
          service:services(name, estimated_hours),
          board:boards(name)
        `)
        .eq("created_by", user.id)
        .eq("board_id", selectedBoardId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as DemandRequest[];
    },
    enabled: !!user && !!selectedBoardId,
  });
}

// Count pending requests for badge - filtered by board
export function usePendingRequestsCount() {
  const { selectedBoardId } = useSelectedBoardSafe();

  return useQuery({
    queryKey: ["demand-requests", "count", selectedBoardId],
    queryFn: async () => {
      if (!selectedBoardId) return 0;

      const { count, error } = await supabase
        .from("demand_requests")
        .select("*", { count: "exact", head: true })
        .eq("board_id", selectedBoardId)
        .eq("status", "pending");

      if (error) throw error;
      return count || 0;
    },
    enabled: !!selectedBoardId,
  });
}

// Count returned requests for the current user (needs attention)
export function useReturnedRequestsCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["demand-requests", "returned-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const { count, error } = await supabase
        .from("demand_requests")
        .select("*", { count: "exact", head: true })
        .eq("created_by", user.id)
        .eq("status", "returned");

      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });
}

// Create a new demand request - requires board_id
export function useCreateDemandRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (data: {
      team_id: string;
      board_id: string;
      title: string;
      description?: string;
      priority?: string;
      service_id?: string;
      subdemands_plan?: Array<{
        tempId: string;
        title: string;
        description?: string;
        priority?: string;
        service_id?: string;
        dependsOnIndex?: number;
      }>;
    }) => {
      if (!user) throw new Error("Usuário não autenticado");

      // Get user's profile name
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      const requesterName = profile?.full_name || "Usuário";

      const { subdemands_plan = [], ...rest } = data;

      const { data: result, error } = await supabase
        .from("demand_requests")
        .insert({
          ...rest,
          created_by: user.id,
          subdemands_plan: subdemands_plan as any,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Send email and in-app notifications via edge function (fire and forget)
      supabase.functions
        .invoke("notify-demand-request", {
          body: {
            requestId: result.id,
            teamId: data.team_id,
            boardId: data.board_id,
            title: data.title,
            description: data.description,
            priority: data.priority || "média",
            requesterName,
          },
        })
        .then((response) => {
          if (response.error) {
            console.error("Failed to send email/in-app notifications:", response.error);
          } else {
            console.log("Email and in-app notifications sent to team members");
          }
        })
        .catch((err) => {
          console.error("Error sending email/in-app notifications:", err);
        });

      // Send push notifications to admins, moderators and executors (fire and forget)
      (async () => {
        try {
          // Get board name for the notification
          const { data: boardData } = await supabase
            .from("boards")
            .select("name")
            .eq("id", data.board_id)
            .single();
          
          const boardName = boardData?.name || "";
          
          const { data: boardMembers, error: boardError } = await supabase
            .from("board_members")
            .select("user_id, role")
            .eq("board_id", data.board_id)
            .in("role", ["admin", "moderator", "executor"]);

          if (boardError) {
            console.error("Error fetching board members for push:", boardError);
            return;
          }
          
          if (boardMembers && boardMembers.length > 0) {
            const memberIds = boardMembers
              .filter(m => m.user_id !== user.id)
              .map(m => m.user_id);
            
            if (memberIds.length > 0) {
              const pushResult = await sendDemandRequestPushNotification({
                adminIds: memberIds,
                requesterName,
                requestTitle: data.title,
                boardName,
              });
              console.log("Push notification result:", pushResult);
            }
          }
        } catch (err) {
          console.error("Error sending push notifications:", err);
        }
      })();

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand-requests"] });
    },
  });
}

// Update a demand request (for resubmission)
export function useUpdateDemandRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      description?: string;
      priority?: string;
      service_id?: string;
      status?: string;
      subdemands_plan?: any;
    }) => {
      // Only reset to "pending" when the requester is resubmitting a returned request.
      // Editing an already-approved/pending request must preserve its status.
      const { data: current, error: fetchError } = await supabase
        .from("demand_requests")
        .select("status")
        .eq("id", id)
        .single();
      if (fetchError) throw fetchError;

      const patch: Record<string, unknown> = { ...data };
      if (current?.status === "returned") {
        patch.status = "pending";
        patch.rejection_reason = null;
      }

      const { data: result, error } = await supabase
        .from("demand_requests")
        .update(patch as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand-requests"] });
    },
  });
}

// Approve a request and create the demand
export function useApproveDemandRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      requestId,
      assigneeIds,
      dueDate,
    }: {
      requestId: string;
      assigneeIds: string[];
      dueDate?: string;
    }) => {
      if (!user) throw new Error("Usuário não autenticado");

      // Get the request details
      const { data: request, error: fetchError } = await supabase
        .from("demand_requests")
        .select("*, service:services(estimated_hours)")
        .eq("id", requestId)
        .single();

      if (fetchError) throw fetchError;
      if (!request) throw new Error("Solicitação não encontrada");

      // Get default status for the specific board
      const { data: boardStatuses } = await supabase
        .from("board_statuses")
        .select("status_id, demand_statuses:demand_statuses!board_statuses_status_id_fkey(id, name)")
        .eq("board_id", request.board_id)
        .order("position", { ascending: true });

      const defaultBoardStatus = boardStatuses?.find(
        (bs: any) => bs.demand_statuses?.name === "A Iniciar"
      );
      const defaultStatusId = defaultBoardStatus?.status_id || boardStatuses?.[0]?.status_id;

      if (!defaultStatusId) throw new Error("Status padrão não encontrado para este quadro");

      

      // Create the demand
      const { data: demand, error: demandError } = await supabase
        .from("demands")
        .insert({
          team_id: request.team_id,
          board_id: request.board_id,
          created_by: request.created_by,
          title: request.title,
          description: request.description,
          priority: request.priority,
          service_id: request.service_id,
          status_id: defaultStatusId,
          due_date: dueDate || null,
        })
        .select()
        .single();

      if (demandError) throw demandError;

      // Add assignees
      if (assigneeIds.length > 0 && demand) {
        const { error: assignError } = await supabase
          .from("demand_assignees")
          .insert(
            assigneeIds.map((userId) => ({
              demand_id: demand.id,
              user_id: userId,
            }))
          );

        if (assignError) console.error("Erro ao atribuir responsáveis:", assignError);
      }

      // Copy PARENT-level attachments (subdemand_index is null) from request to demand
      if (demand) {
        const { data: requestAttachments } = await supabase
          .from("demand_request_attachments")
          .select("*")
          .eq("demand_request_id", requestId)
          .is("comment_id", null)
          .is("subdemand_index", null);

        if (requestAttachments && requestAttachments.length > 0) {
          // Insert attachment records pointing to the same files
          // Use current user as uploaded_by to satisfy RLS policy (uploaded_by = auth.uid())
          const { error: attachError } = await supabase
            .from("demand_attachments")
            .insert(
              requestAttachments.map((att) => ({
                demand_id: demand.id,
                file_name: att.file_name,
                file_path: att.file_path,
                file_type: att.file_type,
                file_size: att.file_size,
                uploaded_by: user.id,
              }))
            );

          if (attachError) console.error("Erro ao copiar anexos:", attachError);
        }
      }

      // Materialize subdemands from the request's saved plan
      const plan = Array.isArray((request as any).subdemands_plan)
        ? ((request as any).subdemands_plan as Array<any>)
        : [];

      if (demand && plan.length > 0) {
        const createdSubIds: string[] = [];

        for (let i = 0; i < plan.length; i++) {
          const item = plan[i] || {};
          const { data: subDemand, error: subError } = await supabase
            .from("demands")
            .insert({
              team_id: request.team_id,
              board_id: request.board_id,
              created_by: request.created_by,
              parent_demand_id: demand.id,
              title: String(item.title || "Subdemanda"),
              description: item.description || null,
              priority: item.priority || "média",
              service_id: item.service_id || null,
              status_id: defaultStatusId,
              due_date: null,
            })
            .select("id")
            .single();

          if (subError || !subDemand) {
            console.error("Erro ao criar subdemanda:", subError);
            createdSubIds.push("");
            continue;
          }

          createdSubIds.push(subDemand.id);

          // Copy attachments for this subdemand (subdemand_index = i)
          const { data: subAttachments } = await supabase
            .from("demand_request_attachments")
            .select("*")
            .eq("demand_request_id", requestId)
            .is("comment_id", null)
            .eq("subdemand_index", i);

          if (subAttachments && subAttachments.length > 0) {
            const { error: subAttachError } = await supabase
              .from("demand_attachments")
              .insert(
                subAttachments.map((att) => ({
                  demand_id: subDemand.id,
                  file_name: att.file_name,
                  file_path: att.file_path,
                  file_type: att.file_type,
                  file_size: att.file_size,
                  uploaded_by: user.id,
                }))
              );
            if (subAttachError) console.error("Erro ao copiar anexos da subdemanda:", subAttachError);
          }
        }

        // Create dependencies (travamento) between subdemands
        const dependencyRows: Array<{ demand_id: string; depends_on_demand_id: string }> = [];
        for (let i = 0; i < plan.length; i++) {
          const item = plan[i] || {};
          const dep = item.dependsOnIndex;
          if (typeof dep === "number" && dep >= 0 && dep < i) {
            const from = createdSubIds[i];
            const to = createdSubIds[dep];
            if (from && to) dependencyRows.push({ demand_id: from, depends_on_demand_id: to });
          }
        }
        if (dependencyRows.length > 0) {
          const { error: depError } = await supabase
            .from("demand_dependencies")
            .insert(dependencyRows);
          if (depError) console.error("Erro ao criar dependências entre subdemandas:", depError);
        }
      }

      // Update request status — use .select() to detect silent RLS 0-row updates
      const { data: updated, error: updateError } = await supabase
        .from("demand_requests")
        .update({
          status: "approved",
          responded_by: user.id,
          responded_at: new Date().toISOString(),
        })
        .eq("id", requestId)
        .select("id")
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updated) {
        throw new Error(
          "Não foi possível aprovar a solicitação: você não tem permissão de aprovador neste quadro."
        );
      }

      return demand;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand-requests"] });
      queryClient.invalidateQueries({ queryKey: ["demands"] });
    },
  });
}

// Return a request to the requester
export function useReturnDemandRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      requestId,
      reason,
    }: {
      requestId: string;
      reason: string;
    }) => {
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("demand_requests")
        .update({
          status: "returned",
          rejection_reason: reason,
          responded_by: user.id,
          responded_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand-requests"] });
    },
  });
}

// Delete a pending request
export function useDeleteDemandRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const { error } = await supabase
        .from("demand_requests")
        .delete()
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demand-requests"] });
    },
  });
}
