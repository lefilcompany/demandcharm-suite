import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ShareToken {
  id: string;
  demand_id: string;
  token: string;
  created_by: string;
  created_at: string;
  expires_at: string | null;
  is_active: boolean;
  auto_join_board: boolean;
}

interface SharedDemandPayload {
  demand: any;
  interactions: any[];
  attachments: any[];
  auto_join_board?: boolean;
}

function generateToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function resolveSharedErrorCode(error: unknown): Promise<"INVALID_TOKEN" | "EXPIRED_TOKEN" | "LOAD_ERROR"> {
  const fallback: "LOAD_ERROR" = "LOAD_ERROR";

  if (!error || typeof error !== "object") {
    return fallback;
  }

  const maybeContext = (error as { context?: unknown }).context;
  if (maybeContext instanceof Response) {
    try {
      const payload = (await maybeContext.clone().json()) as { code?: string };
      if (payload?.code === "INVALID_TOKEN" || payload?.code === "EXPIRED_TOKEN") {
        return payload.code;
      }
    } catch {
      // ignore parse errors and fallback to status code mapping
    }

    if (maybeContext.status === 410) {
      return "EXPIRED_TOKEN";
    }

    if (maybeContext.status === 403 || maybeContext.status === 404) {
      return "INVALID_TOKEN";
    }
  }

  const message = ((error as { message?: string }).message || "").toUpperCase();
  if (message.includes("EXPIRED")) return "EXPIRED_TOKEN";
  if (message.includes("INVALID") || message.includes("403") || message.includes("404")) {
    return "INVALID_TOKEN";
  }

  return fallback;
}

async function fetchSharedDemandPayload(token: string): Promise<SharedDemandPayload> {
  const { data, error } = await supabase.functions.invoke("shared-demand", {
    body: { token },
  });

  if (error) {
    const code = await resolveSharedErrorCode(error);
    throw new Error(code);
  }

  const payload = data as SharedDemandPayload | null;
  if (!payload?.demand) {
    throw new Error("INVALID_TOKEN");
  }

  return {
    demand: payload.demand,
    interactions: payload.interactions || [],
    attachments: payload.attachments || [],
    auto_join_board: !!payload.auto_join_board,
  };
}

function sharedPayloadQueryConfig(token: string | null) {
  return {
    queryKey: ["shared-demand-payload", token],
    queryFn: () => fetchSharedDemandPayload(token as string),
    enabled: !!token,
    retry: false as const,
    staleTime: 1000 * 60 * 5,
  };
}

export function useShareToken(demandId: string | null) {
  return useQuery({
    queryKey: ["share-token", demandId],
    queryFn: async () => {
      if (!demandId) return null;

      const result = await supabase
        .from("demand_share_tokens" as any)
        .select("*")
        .eq("demand_id", demandId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (result.error) throw result.error;

      const token = result.data as unknown as ShareToken | null;

      if (token?.expires_at && new Date(token.expires_at) <= new Date()) {
        await supabase
          .from("demand_share_tokens" as any)
          .update({ is_active: false })
          .eq("id", token.id);
        return null;
      }

      return token;
    },
    enabled: !!demandId,
  });
}

export function useCreateShareToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      demandId,
      userId,
      expiresAt,
      autoJoinBoard,
    }: {
      demandId: string;
      userId: string;
      expiresAt?: string | null;
      autoJoinBoard?: boolean;
    }) => {
      const token = generateToken();

      const result = await supabase
        .from("demand_share_tokens" as any)
        .insert({
          demand_id: demandId,
          token,
          created_by: userId,
          expires_at: expiresAt || null,
          auto_join_board: !!autoJoinBoard,
        })
        .select()
        .single();

      if (result.error) throw result.error;
      return result.data as unknown as ShareToken;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["share-token", variables.demandId] });
    },
  });
}

export function useRevokeShareToken() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tokenId: string) => {
      const result = await supabase
        .from("demand_share_tokens" as any)
        .update({ is_active: false })
        .eq("id", tokenId);

      if (result.error) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["share-token"] });
    },
  });
}

export function useUpdateShareTokenAutoJoin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tokenId, autoJoinBoard }: { tokenId: string; autoJoinBoard: boolean }) => {
      const result = await supabase
        .from("demand_share_tokens" as any)
        .update({ auto_join_board: autoJoinBoard })
        .eq("id", tokenId);
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["share-token"] });
    },
  });
}

export function useSharedDemand(token: string | null) {
  return useQuery({
    ...sharedPayloadQueryConfig(token),
    select: (payload: SharedDemandPayload) => payload.demand,
  });
}

export function useSharedDemandAutoJoin(token: string | null) {
  return useQuery({
    ...sharedPayloadQueryConfig(token),
    select: (payload: SharedDemandPayload) => !!payload.auto_join_board,
  });
}

export function useSharedDemandInteractions(token: string | null, demandId: string | null) {
  return useQuery({
    ...sharedPayloadQueryConfig(token),
    enabled: !!token && !!demandId,
    select: (payload: SharedDemandPayload) => (demandId ? payload.interactions : []),
  });
}

export function useSharedDemandAttachments(token: string | null, demandId: string | null) {
  return useQuery({
    ...sharedPayloadQueryConfig(token),
    enabled: !!token && !!demandId,
    select: (payload: SharedDemandPayload) => (demandId ? payload.attachments : []),
  });
}

export async function joinBoardViaShareToken(token: string) {
  const { data, error } = await supabase.rpc("join_board_via_share_token" as any, { p_token: token });
  if (error) throw error;
  return data as { success: boolean; reason?: string; demand_id?: string; board_id?: string };
}
